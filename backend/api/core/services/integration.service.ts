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
