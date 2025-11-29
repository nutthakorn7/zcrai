import { db } from '../../infra/db'
import { apiKeys } from '../../infra/db/schema'
import { eq, and } from 'drizzle-orm'
import { Encryption } from '../../utils/encryption'

export const IntegrationService = {
  // ==================== LIST INTEGRATIONS ====================
  async list(tenantId: string) {
    const keys = await db.select({
      id: apiKeys.id,
      provider: apiKeys.provider,
      label: apiKeys.label,
      keyId: apiKeys.keyId,
      encryptedKey: apiKeys.encryptedKey,
      lastUsedAt: apiKeys.lastUsedAt,
      lastSyncStatus: apiKeys.lastSyncStatus,
      lastSyncError: apiKeys.lastSyncError,
      lastSyncAt: apiKeys.lastSyncAt,
      createdAt: apiKeys.createdAt,
    })
    .from(apiKeys)
    .where(eq(apiKeys.tenantId, tenantId))

    // เพิ่ม hasApiKey และ sync status fields
    return keys.map(key => ({
      id: key.id,
      provider: key.provider,
      label: key.label,
      keyId: key.keyId,
      lastUsedAt: key.lastUsedAt,
      lastSyncStatus: key.lastSyncStatus,   // 'success' | 'error' | null
      lastSyncError: key.lastSyncError,     // Error message
      lastSyncAt: key.lastSyncAt,           // Last sync timestamp
      createdAt: key.createdAt,
      hasApiKey: !!key.encryptedKey && key.encryptedKey.length > 0,
    }))
  },

  // ==================== LIST FOR COLLECTOR (พร้อม Decrypted Config) ====================
  async listForCollector(type?: string) {
    let query = db.select().from(apiKeys)
    
    // กรองตาม type ถ้ามี
    const results = type 
      ? await query.where(eq(apiKeys.provider, type))
      : await query

    // Decrypt config และแปลง format สำหรับ Collector
    return results.map(integration => {
      let config = {}
      try {
        const decrypted = Encryption.decrypt(integration.encryptedKey)
        const parsed = JSON.parse(decrypted)

        // แปลง format ตาม provider
        switch (integration.provider) {
          case 'sentinelone':
            config = {
              baseUrl: parsed.url,
              apiToken: parsed.token
            }
            break
          case 'crowdstrike':
            config = {
              baseUrl: parsed.baseUrl,
              clientId: parsed.clientId,
              clientSecret: parsed.clientSecret
            }
            break
          default:
            config = parsed
        }
      } catch (e) {
        config = { error: 'Failed to decrypt' }
      }

      return {
        id: integration.id,
        tenantId: integration.tenantId,
        type: integration.provider === 'sentinelone' || integration.provider === 'crowdstrike' 
          ? integration.provider 
          : 'ai',
        provider: integration.provider,
        config: JSON.stringify(config),
        status: 'active',
        lastSyncAt: integration.lastUsedAt?.toISOString() || null,
        lastSyncStatus: integration.lastSyncStatus || null // pending, success, error
      }
    })
  },

  // ==================== ADD SENTINELONE ====================
  async addSentinelOne(tenantId: string, data: { url: string; token: string; label?: string }) {
    // Validate URL
    let baseUrl = data.url
    if (baseUrl.endsWith('/')) baseUrl = baseUrl.slice(0, -1)
    if (baseUrl.endsWith('/web/api/v2.1/threats')) baseUrl = baseUrl.replace('/web/api/v2.1/threats', '')
    
    // เช็ค URL ซ้ำ - ถ้าซ้ำให้ UPDATE แทน INSERT
    const existingKeys = await db.select().from(apiKeys)
      .where(and(eq(apiKeys.tenantId, tenantId), eq(apiKeys.provider, 'sentinelone')))
    
    let existingIntegration = null
    for (const existing of existingKeys) {
      try {
        const config = JSON.parse(Encryption.decrypt(existing.encryptedKey))
        if (config.url === baseUrl) {
          existingIntegration = existing
          break
        }
      } catch (e: any) {
        // ถ้า decrypt ไม่ได้ ก็ข้ามไป
      }
    }

    // ถ้า Label ซ้ำกับ integration อื่น (ไม่ใช่ตัวที่จะ update) → throw error
    if (data.label) {
      for (const existing of existingKeys) {
        if (existing.label === data.label && existing.id !== existingIntegration?.id) {
          throw new Error('Label already exists. Please choose a different name.')
        }
      }
    }
    
    // Test Connection ก่อน Save/Update
    await this.testSentinelOneConnection(baseUrl, data.token)

    // Save Encrypted Token
    const encryptedKey = Encryption.encrypt(JSON.stringify({
      url: baseUrl,
      token: data.token
    }))

    let integration
    if (existingIntegration) {
      // URL ซ้ำ → UPDATE API Key
      const [updated] = await db.update(apiKeys)
        .set({
          encryptedKey,
          label: data.label || existingIntegration.label,
          lastSyncStatus: 'pending', // Reset sync status
          lastSyncError: null,
        })
        .where(eq(apiKeys.id, existingIntegration.id))
        .returning()
      integration = updated
    } else {
      // URL ใหม่ → INSERT
      const [inserted] = await db.insert(apiKeys).values({
        tenantId,
        provider: 'sentinelone',
        encryptedKey,
        label: data.label || 'SentinelOne Integration',
        lastSyncStatus: 'pending',
      }).returning()
      integration = inserted
    }

    // Trigger Collector ให้ sync ทันที
    this.triggerCollectorSync('sentinelone')

    return integration
  },

  // ==================== ADD CROWDSTRIKE ====================
  async addCrowdStrike(tenantId: string, data: { clientId: string; clientSecret: string; baseUrl?: string; label?: string }) {
    let baseUrl = data.baseUrl || 'https://api.us-2.crowdstrike.com'
    if (baseUrl.endsWith('/')) baseUrl = baseUrl.slice(0, -1)

    // เช็ค Client ID ซ้ำ - ถ้าซ้ำให้ UPDATE แทน INSERT
    const existingKeys = await db.select().from(apiKeys)
      .where(and(eq(apiKeys.tenantId, tenantId), eq(apiKeys.provider, 'crowdstrike')))
    
    let existingIntegration = null
    for (const existing of existingKeys) {
      if (existing.keyId === data.clientId) {
        existingIntegration = existing
        break
      }
    }

    // ถ้า Label ซ้ำกับ integration อื่น (ไม่ใช่ตัวที่จะ update) → throw error
    if (data.label) {
      for (const existing of existingKeys) {
        if (existing.label === data.label && existing.id !== existingIntegration?.id) {
          throw new Error('Label already exists. Please choose a different name.')
        }
      }
    }

    // Test Connection ก่อน Save/Update
    await this.testCrowdStrikeConnection(baseUrl, data.clientId, data.clientSecret)

    // Save Encrypted Credentials
    const encryptedKey = Encryption.encrypt(JSON.stringify({
      baseUrl,
      clientId: data.clientId,
      clientSecret: data.clientSecret
    }))

    let integration
    if (existingIntegration) {
      // Client ID ซ้ำ → UPDATE credentials
      const [updated] = await db.update(apiKeys)
        .set({
          encryptedKey,
          label: data.label || existingIntegration.label,
          lastSyncStatus: 'pending', // Reset sync status
          lastSyncError: null,
        })
        .where(eq(apiKeys.id, existingIntegration.id))
        .returning()
      integration = updated
    } else {
      // Client ID ใหม่ → INSERT
      const [inserted] = await db.insert(apiKeys).values({
        tenantId,
        provider: 'crowdstrike',
        encryptedKey,
        keyId: data.clientId,
        label: data.label || 'CrowdStrike Integration',
        lastSyncStatus: 'pending',
      }).returning()
      integration = inserted
    }

    // Trigger Collector ให้ sync ทันที
    this.triggerCollectorSync('crowdstrike')

    return integration
  },

  // ==================== ADD AI PROVIDER ====================
  async addAI(tenantId: string, provider: string, data: { apiKey: string; model?: string; label?: string; baseUrl?: string }) {
    if (!data.apiKey) throw new Error('API Key is required')

    // เช็ค Label ซ้ำ
    const existingKeys = await db.select().from(apiKeys)
      .where(and(eq(apiKeys.tenantId, tenantId), eq(apiKeys.provider, provider)))
    
    for (const existing of existingKeys) {
      if (existing.label === data.label) {
        throw new Error('Label already exists. Please choose a different name.')
      }
    }

    // Test Connection
    await this.testAIConnection(provider, data.apiKey, data.model)

    // Save Encrypted Key & Config
    const encryptedKey = Encryption.encrypt(JSON.stringify({
      apiKey: data.apiKey,
      model: data.model,
      baseUrl: data.baseUrl
    }))

    const [integration] = await db.insert(apiKeys).values({
      tenantId,
      provider,
      encryptedKey,
      label: data.label || `${provider.toUpperCase()} Integration`,
    }).returning()

    // Trigger Collector ให้ sync ทันที
    this.triggerCollectorSync('ai')

    return integration
  },

  // ... (update function remains the same) ...

  // ==================== TEST CONNECTION (AI) ====================
  async testAIConnection(provider: string, apiKey: string, model?: string) {
    try {
      let url = ''
      let headers: Record<string, string> = {}

      switch (provider) {
        case 'openai':
          url = 'https://api.openai.com/v1/models'
          headers = { 'Authorization': `Bearer ${apiKey}` }
          break
        case 'claude':
          url = 'https://api.anthropic.com/v1/models?limit=1'
          headers = { 
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01'
          }
          break
        case 'gemini':
          // Gemini uses query param for key usually, but let's try a basic discovery or just skip deep check if complex
          // For now, assume simple check isn't easily available without specific payload.
          // Or use: https://generativelanguage.googleapis.com/v1beta/models?key=API_KEY
          url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`
          break
        default:
          // Skip test for unknown providers or mock success
          return true
      }

      const response = await fetch(url, { headers })
      
      if (!response.ok) {
        const error = await response.text()
        throw new Error(`${provider.toUpperCase()} Connection Failed: ${response.status} - ${error.slice(0, 100)}`)
      }
      
      return true
    } catch (e: any) {
      throw new Error(e.message)
    }
  },

  // ... (testSentinelOneConnection, testCrowdStrikeConnection remain the same) ...

  // ==================== UPDATE INTEGRATION ====================
  async update(id: string, tenantId: string, data: { label?: string; isActive?: boolean }) {
    const [updated] = await db.update(apiKeys)
      .set({
        ...data,
        // updatedAt: new Date(), // Comment out if not in schema
      })
      .where(and(eq(apiKeys.id, id), eq(apiKeys.tenantId, tenantId)))
      .returning()

    if (!updated) throw new Error('Integration not found')
    return updated
  },

  // ==================== TEST EXISTING INTEGRATION ====================
  async testExisting(id: string, tenantId: string) {
    // 1. Get Integration
    const [integration] = await db.select().from(apiKeys)
      .where(and(eq(apiKeys.id, id), eq(apiKeys.tenantId, tenantId)))
    
    if (!integration) throw new Error('Integration not found')

    // 2. Decrypt Key
    const decryptedJson = Encryption.decrypt(integration.encryptedKey)
    const data = JSON.parse(decryptedJson)

    // 3. Test based on Provider และอัพเดท sync status
    try {
      let result = false
      switch (integration.provider) {
        case 'sentinelone':
          result = await this.testSentinelOneConnection(data.url, data.token)
          break
        case 'crowdstrike':
          result = await this.testCrowdStrikeConnection(data.baseUrl, data.clientId, data.clientSecret)
          break
        case 'openai':
        case 'claude':
        case 'gemini':
        case 'deepseek':
          result = await this.testAIConnection(integration.provider, data.apiKey)
          break
        default:
          throw new Error('Unknown provider')
      }

      // Test สำเร็จ → อัพเดท status เป็น success
      await this.updateSyncStatus(tenantId, integration.provider, 'success')
      return result
    } catch (error: any) {
      // Test ล้มเหลว → อัพเดท status เป็น error พร้อม error message
      await this.updateSyncStatus(tenantId, integration.provider, 'error', error.message)
      throw error
    }
  },

  // ==================== DELETE INTEGRATION ====================
  async delete(id: string, tenantId: string) {
    const [deleted] = await db.delete(apiKeys)
      .where(and(eq(apiKeys.id, id), eq(apiKeys.tenantId, tenantId)))
      .returning()
    
    if (!deleted) throw new Error('Integration not found')
    return deleted
  },

  // ==================== TEST CONNECTION (S1) ====================
  async testSentinelOneConnection(url: string, token: string) {
    try {
      const endpoint = `${url}/web/api/v2.1/system/status`
      const response = await fetch(endpoint, {
        headers: {
          'Authorization': `ApiToken ${token}`,
          'Content-Type': 'application/json'
        }
      })

      if (!response.ok) {
        const error = await response.text()
        throw new Error(`S1 Connection Failed: ${response.status} ${error}`)
      }
      return true
    } catch (e: any) {
      throw new Error(`S1 Connection Error: ${e.message}`)
    }
  },

  // ==================== TEST CONNECTION (CrowdStrike) ====================
  async testCrowdStrikeConnection(baseUrl: string, clientId: string, clientSecret: string) {
    try {
      // 1. Get Bearer Token
      const tokenUrl = `${baseUrl}/oauth2/token`
      const params = new URLSearchParams()
      params.append('client_id', clientId)
      params.append('client_secret', clientSecret)

      const tokenRes = await fetch(tokenUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params
      })

      if (!tokenRes.ok) {
        const error = await tokenRes.text()
        throw new Error(`CS Auth Failed: ${tokenRes.status} ${error}`)
      }

      const tokenData = await tokenRes.json() as { access_token: string }
      const accessToken = tokenData.access_token

      if (!accessToken) {
        throw new Error('CS Auth Failed: No access token returned')
      }

      // 2. Verify Token (Optional: List queries)
      // Note: Skipping deep verification to avoid permission issues. 
      // Getting a token confirms Client ID/Secret are valid.
      
      return true
    } catch (e: any) {
      throw new Error(`CrowdStrike Connection Error: ${e.message}`)
    }
  },

  // ==================== GET AI CONFIG ====================
  async getAIConfig(tenantId: string) {
    // Prioritize Claude/Anthropic first, then OpenAI
    // Or allow user to select default in future
    const providers = ['claude', 'anthropic', 'openai', 'gpt', 'gemini', 'deepseek']
    
    const keys = await db.select().from(apiKeys)
      .where(and(
        eq(apiKeys.tenantId, tenantId)
      ))

    // Filter only AI providers
    const aiKeys = keys.filter(k => providers.includes(k.provider.toLowerCase()))
    
    if (aiKeys.length === 0) return null

    // Sort by last updated or created desc to get latest
    aiKeys.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    
    const selected = aiKeys[0]

    try {
      const decrypted = Encryption.decrypt(selected.encryptedKey)
      const config = JSON.parse(decrypted)
      return {
        provider: selected.provider.toLowerCase(),
        apiKey: config.apiKey,
        ...config // include other fields if any
      }
    } catch (e) {
      console.error('Failed to decrypt AI key:', e)
      return null
    }
  },

  // ==================== UPDATE SYNC STATUS (สำหรับ Collector) ====================
  async updateSyncStatus(tenantId: string, provider: string, status: 'success' | 'error', error?: string) {
    await db.update(apiKeys)
      .set({
        lastSyncStatus: status,
        lastSyncError: status === 'error' ? error?.slice(0, 500) : null, // จำกัด 500 chars
        lastSyncAt: new Date(),
      })
      .where(and(eq(apiKeys.tenantId, tenantId), eq(apiKeys.provider, provider)))
  },

  // ==================== TRIGGER COLLECTOR SYNC ====================
  async triggerCollectorSync(provider: string) {
    try {
      const collectorUrl = process.env.COLLECTOR_URL || 'http://localhost:8001'
      // provider: 'sentinelone', 'crowdstrike', 'all'
      const source = provider === 'all' ? 'all' : provider
      
      await fetch(`${collectorUrl}/collect/${source}`, {
        method: 'POST'
      })
    } catch (e) {
      console.error('Failed to trigger collector:', e)
      // ไม่ throw error เพราะไม่ควรขัดขวาง flow หลัก
    }
  }
}
