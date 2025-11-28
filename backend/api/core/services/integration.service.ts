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
      keyId: apiKeys.keyId, // for CS Client ID
      lastUsedAt: apiKeys.lastUsedAt,
      createdAt: apiKeys.createdAt,
    })
    .from(apiKeys)
    .where(eq(apiKeys.tenantId, tenantId))

    return keys
  },

  // ==================== ADD SENTINELONE ====================
  async addSentinelOne(tenantId: string, data: { url: string; token: string; label?: string }) {
    // Validate URL
    let baseUrl = data.url
    if (baseUrl.endsWith('/')) baseUrl = baseUrl.slice(0, -1)
    if (baseUrl.endsWith('/web/api/v2.1/threats')) baseUrl = baseUrl.replace('/web/api/v2.1/threats', '')
    
    // Test Connection
    await this.testSentinelOneConnection(baseUrl, data.token)

    // Save Encrypted Token
    const encryptedKey = Encryption.encrypt(JSON.stringify({
      url: baseUrl,
      token: data.token
    }))

    const [integration] = await db.insert(apiKeys).values({
      tenantId,
      provider: 'sentinelone',
      encryptedKey,
      label: data.label || 'SentinelOne Integration',
    }).returning()

    return integration
  },

  // ==================== ADD CROWDSTRIKE ====================
  async addCrowdStrike(tenantId: string, data: { clientId: string; clientSecret: string; baseUrl?: string; label?: string }) {
    let baseUrl = data.baseUrl || 'https://api.us-2.crowdstrike.com'
    if (baseUrl.endsWith('/')) baseUrl = baseUrl.slice(0, -1)

    // Test Connection
    await this.testCrowdStrikeConnection(baseUrl, data.clientId, data.clientSecret)

    // Save Encrypted Credentials
    const encryptedKey = Encryption.encrypt(JSON.stringify({
      baseUrl,
      clientId: data.clientId,
      clientSecret: data.clientSecret
    }))

    const [integration] = await db.insert(apiKeys).values({
      tenantId,
      provider: 'crowdstrike',
      encryptedKey,
      keyId: data.clientId,
      label: data.label || 'CrowdStrike Integration',
    }).returning()

    return integration
  },

  // ==================== ADD AI PROVIDER ====================
  async addAI(tenantId: string, provider: string, data: { apiKey: string; label?: string }) {
    if (!data.apiKey) throw new Error('API Key is required')

    // Test Connection
    await this.testAIConnection(provider, data.apiKey)

    // Save Encrypted Key
    const encryptedKey = Encryption.encrypt(JSON.stringify({
      apiKey: data.apiKey
    }))

    const [integration] = await db.insert(apiKeys).values({
      tenantId,
      provider,
      encryptedKey,
      label: data.label || `${provider.toUpperCase()} Integration`,
    }).returning()

    return integration
  },

  // ... (update function remains the same) ...

  // ==================== TEST CONNECTION (AI) ====================
  async testAIConnection(provider: string, apiKey: string) {
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

    // 3. Test based on Provider
    switch (integration.provider) {
      case 'sentinelone':
        return await this.testSentinelOneConnection(data.url, data.token)
      case 'crowdstrike':
        return await this.testCrowdStrikeConnection(data.baseUrl, data.clientId, data.clientSecret)
      case 'openai':
      case 'claude':
      case 'gemini':
      case 'deepseek':
        return await this.testAIConnection(integration.provider, data.apiKey)
      default:
        throw new Error('Unknown provider')
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
  }
}
