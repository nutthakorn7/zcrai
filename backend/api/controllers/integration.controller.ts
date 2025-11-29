import { Elysia } from 'elysia'
import { jwt } from '@elysiajs/jwt'
import { IntegrationService } from '../core/services/integration.service'
import { tenantAdminOnly } from '../middlewares/auth.middleware'
import { AddSentinelOneSchema, AddCrowdStrikeSchema, AddAISchema, UpdateIntegrationSchema } from '../validators/integration.validator'

const COLLECTOR_API_KEY = process.env.COLLECTOR_API_KEY || 'dev_collector_key_change_in_production'

export const integrationController = new Elysia({ prefix: '/integrations' })
  .use(jwt({
    name: 'jwt',
    secret: process.env.JWT_SECRET || 'super_secret_dev_key',
  }))

  // ==================== COLLECTOR ENDPOINT (ไม่ต้อง JWT - ใช้ API Key) ====================
  .get('/collector', async ({ query, headers, set }) => {
    try {
      // ตรวจสอบ Collector API Key
      const collectorKey = headers['x-collector-key']
      if (collectorKey !== COLLECTOR_API_KEY) {
        set.status = 401
        return { error: 'Invalid collector key' }
      }

      const type = query.type as string | undefined
      const integrations = await IntegrationService.listForCollector(type)
      return { integrations }
    } catch (e: any) {
      set.status = 500
      return { error: e.message }
    }
  })

  // ==================== COLLECTOR: UPDATE SYNC STATUS ====================
  .post('/collector/sync-status', async ({ body, headers, set }) => {
    try {
      const collectorKey = headers['x-collector-key']
      if (collectorKey !== COLLECTOR_API_KEY) {
        set.status = 401
        return { error: 'Invalid collector key' }
      }

      const { tenantId, provider, status, error } = body as {
        tenantId: string
        provider: string
        status: 'success' | 'error'
        error?: string
      }

      await IntegrationService.updateSyncStatus(tenantId, provider, status, error)
      return { success: true }
    } catch (e: any) {
      set.status = 500
      return { error: e.message }
    }
  })

  // ==================== COLLECTOR: GET STATE ====================
  .get('/collector/state', async ({ query, headers, set }) => {
    try {
      const collectorKey = headers['x-collector-key']
      if (collectorKey !== COLLECTOR_API_KEY) {
        set.status = 401
        return { error: 'Invalid collector key' }
      }

      const tenantId = query.tenantId as string
      const provider = query.provider as string
      const urlHash = query.urlHash as string

      if (!tenantId || !provider || !urlHash) {
        set.status = 400
        return { error: 'tenantId, provider, and urlHash are required' }
      }

      const state = await IntegrationService.getCollectorState(tenantId, provider, urlHash)
      return { state }
    } catch (e: any) {
      set.status = 500
      return { error: e.message }
    }
  })

  // ==================== COLLECTOR: UPDATE STATE ====================
  .post('/collector/state', async ({ body, headers, set }) => {
    try {
      const collectorKey = headers['x-collector-key']
      if (collectorKey !== COLLECTOR_API_KEY) {
        set.status = 401
        return { error: 'Invalid collector key' }
      }

      const { tenantId, provider, urlHash, checkpoint, fullSyncComplete, eventCount } = body as {
        tenantId: string
        provider: string
        urlHash: string
        checkpoint?: string // ISO timestamp
        fullSyncComplete?: boolean
        eventCount?: { threats?: number; activities?: number; alerts?: number }
      }

      if (!tenantId || !provider || !urlHash) {
        set.status = 400
        return { error: 'tenantId, provider, and urlHash are required' }
      }

      await IntegrationService.updateCollectorState(tenantId, provider, urlHash, {
        checkpoint: checkpoint ? new Date(checkpoint) : undefined,
        fullSyncComplete,
        eventCount,
      })
      return { success: true }
    } catch (e: any) {
      set.status = 500
      return { error: e.message }
    }
  })

  .use(tenantAdminOnly)

  // ==================== LIST INTEGRATIONS ====================
  .get('/', async ({ jwt, cookie: { access_token }, set }) => {
    try {
      const payload = await jwt.verify(access_token.value)
      if (!payload) throw new Error('Unauthorized')

      return await IntegrationService.list(payload.tenantId as string)
    } catch (e: any) {
      set.status = 400
      return { error: e.message }
    }
  })

  // ==================== ADD SENTINELONE ====================
  .post('/sentinelone', async ({ body, jwt, cookie: { access_token }, set }) => {
    try {
      const payload = await jwt.verify(access_token.value)
      if (!payload) throw new Error('Unauthorized')

      const integration = await IntegrationService.addSentinelOne(payload.tenantId as string, body)
      set.status = 201
      return { message: 'SentinelOne integration added successfully', integration }
    } catch (e: any) {
      set.status = 400
      return { error: e.message }
    }
  }, { body: AddSentinelOneSchema })

  // ==================== ADD CROWDSTRIKE ====================
  .post('/crowdstrike', async ({ body, jwt, cookie: { access_token }, set }) => {
    try {
      const payload = await jwt.verify(access_token.value)
      if (!payload) throw new Error('Unauthorized')

      const integration = await IntegrationService.addCrowdStrike(payload.tenantId as string, body)
      set.status = 201
      return { message: 'CrowdStrike integration added successfully', integration }
    } catch (e: any) {
      set.status = 400
      return { error: e.message }
    }
  }, { body: AddCrowdStrikeSchema })

  // ==================== ADD AI PROVIDER ====================
  .post('/ai/:provider', async ({ jwt, cookie: { access_token }, params, body, set }) => {
    try {
      const payload = await jwt.verify(access_token.value)
      if (!payload) throw new Error('Unauthorized')

      const { apiKey, model, baseUrl, label } = body as AddAIBody
      const provider = params.provider.toLowerCase()

      if (!apiKey) throw new Error('API Key is required')

      return await IntegrationService.addAI(payload.tenantId as string, provider, {
        apiKey,
        model,
        baseUrl,
        label
      })
    } catch (e: any) {
      set.status = 400
      return { error: e.message }
    }
  })

  // ==================== GET CONFIG (สำหรับ Edit mode) ====================
  .get('/:id/config', async ({ params, jwt, cookie: { access_token }, set }) => {
    try {
      const payload = await jwt.verify(access_token.value)
      if (!payload) throw new Error('Unauthorized')

      const config = await IntegrationService.getConfig(params.id, payload.tenantId as string)
      return config
    } catch (e: any) {
      set.status = 400
      return { error: e.message }
    }
  })

  // ==================== UPDATE INTEGRATION (Label only - backward compatible) ====================
  .put('/:id', async ({ params, body, jwt, cookie: { access_token }, set }) => {
    try {
      const payload = await jwt.verify(access_token.value)
      if (!payload) throw new Error('Unauthorized')

      // ⭐ ใช้ updateFull แทน update เพื่อรองรับ full edit
      const integration = await IntegrationService.updateFull(params.id, payload.tenantId as string, body as any)
      return { message: 'Integration updated successfully', integration }
    } catch (e: any) {
      set.status = 400
      return { error: e.message }
    }
  })

  // ==================== DELETE INTEGRATION ====================
  .delete('/:id', async ({ params, jwt, cookie: { access_token }, set }) => {
    try {
      const payload = await jwt.verify(access_token.value)
      if (!payload) throw new Error('Unauthorized')

      // ⭐ เรียก Collector API เพื่อ cancel sync ก่อนลบ
      const collectorUrl = process.env.COLLECTOR_URL || 'http://localhost:8001'
      try {
        await fetch(`${collectorUrl}/sync/${params.id}`, {
          method: 'DELETE',
          headers: { 'x-collector-key': COLLECTOR_API_KEY },
        })
      } catch (e) {
        // ไม่ต้อง fail ถ้า collector ไม่ตอบ - ยังลบ integration ได้
        console.warn('Failed to notify collector about integration deletion:', e)
      }

      await IntegrationService.delete(params.id, payload.tenantId as string)
      return { message: 'Integration deleted successfully' }
    } catch (e: any) {
      set.status = 400
      return { error: e.message }
    }
  })

  // ==================== TEST CONNECTION (Existing) ====================
  .post('/:id/test', async ({ params, jwt, cookie: { access_token }, set }) => {
    try {
      const payload = await jwt.verify(access_token.value)
      if (!payload) throw new Error('Unauthorized')

      // Logic to fetch key -> decrypt -> test
      // This requires adding a method in Service to retrieve decrypted key and test
      // For now, we will reuse the add logic conceptually or implement a specific test method
      // Let's implement a 'testExisting' in service
      await IntegrationService.testExisting(params.id, payload.tenantId as string)
      
      return { message: 'Connection verification successful', status: 'connected' }
    } catch (e: any) {
      set.status = 400
      return { error: e.message, status: 'disconnected' }
    }
  })
