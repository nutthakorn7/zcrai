/**
 * Integration Controller
 * Manages external security tool integrations (EDR, SIEM, AI providers, threat intel)
 * Supports: SentinelOne, CrowdStrike, AWS, AI providers, enrichment services
 */

import { Elysia } from 'elysia'
import { jwt } from '@elysiajs/jwt'
import { IntegrationService } from '../core/services/integration.service'
import { withAuth } from '../middleware/auth'
import { AddSentinelOneSchema, AddCrowdStrikeSchema, AddAISchema, UpdateIntegrationSchema, AddAWSSchema } from '../validators/integration.validator'

const COLLECTOR_API_KEY = process.env.COLLECTOR_API_KEY || 'dev_collector_key_change_in_production'

interface AddAIBody {
  apiKey: string;
  model?: string;
  baseUrl?: string;
  label?: string;
}

export const integrationController = new Elysia({ prefix: '/integrations' })
  // Note: JWT is configured in withAuth middleware, no need to duplicate here

  /**
   * Get active integrations for data collector
   * @route GET /integrations/collector
   * @access Collector only (API key authentication)
   * @header {string} x-collector-key - Collector API key
   * @query {string} type - Filter by integration type (optional)
   * @returns {Object} List of configured integrations for polling
   * @description Used by external collector service to fetch integration configs
   */
  .get('/collector', async ({ query, headers, set }) => {
    try {
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

  /**
   * Update integration sync status from collector
   * @route POST /integrations/collector/sync-status
   * @access Collector only
   * @header {string} x-collector-key - Collector API key
   * @body {string} tenantId - Tenant ID
   * @body {string} provider - Integration provider
   * @body {string} status - Sync status (success/error)
   * @body {string} error - Error message if status is error
   * @returns {Object} Success confirmation
   */
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

  /**
   * Get collector state for incremental sync
   * @route GET /integrations/collector/state
   * @access Collector only
   * @header {string} x-collector-key - Collector API key
   * @query {string} tenantId - Tenant ID
   * @query {string} provider - Provider name
   * @query {string} urlHash - URL hash for state tracking
   * @returns {Object} Last checkpoint and sync state
   */
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

  /**
   * Update collector state after successful sync
   * @route POST /integrations/collector/state
   * @access Collector only
   * @header {string} x-collector-key - Collector API key
   * @body {string} checkpoint - ISO timestamp of last synced event
   * @body {boolean} fullSyncComplete - Whether initial full sync is complete
   * @body {object} eventCount - Count of events synced
   * @returns {Object} Success confirmation
   */
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
        checkpoint?: string
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

  .use(withAuth)

  /**
   * List all integrations for authenticated tenant
   * @route GET /integrations
   * @access Protected - Admin only
   * @returns {Object} List of configured integrations with status
   */
  .get('/', async ({ user, set }: any) => {
    try {
      console.log(`[IntegrationController] GET / called. User: ${user?.email} Tenant: ${user?.tenantId}`);
      if (!user?.tenantId) throw new Error('Unauthorized - No tenant')
      const result = await IntegrationService.list(user.tenantId as string)
      console.log(`[IntegrationController] List result count: ${result.length}`);
      return result
    } catch (e: any) {
      console.error(`[IntegrationController] GET / failed:`, e);
      set.status = 400
      return { error: e.message }
    }
  })

  /**
   * Add SentinelOne EDR integration
   * @route POST /integrations/sentinelone
   * @access Protected - Admin only
   * @body {string} apiUrl - SentinelOne API URL
   * @body {string} apiToken - API token
   * @returns {Object} Created integration
   */
  .post('/sentinelone', async ({ body, user, set }: any) => {
    try {
      if (!user?.tenantId) throw new Error('Unauthorized')
      const integration = await IntegrationService.addSentinelOne(user.tenantId as string, body)
      set.status = 201
      return { message: 'SentinelOne integration added successfully', integration }
    } catch (e: any) {
      set.status = 400
      return { error: e.message }
    }
  }, { body: AddSentinelOneSchema })

  /**
   * Add CrowdStrike EDR integration
   * @route POST /integrations/crowdstrike
   * @access Protected - Admin only
   * @body {string} clientId - CrowdStrike client ID
   * @body {string} clientSecret - Client secret
   * @returns {Object} Created integration
   */
  .post('/crowdstrike', async ({ body, user, set }: any) => {
    try {
      if (!user?.tenantId) throw new Error('Unauthorized')
      const integration = await IntegrationService.addCrowdStrike(user.tenantId as string, body)
      set.status = 201
      return { message: 'CrowdStrike integration added successfully', integration }
    } catch (e: any) {
      set.status = 400
      return { error: e.message }
    }
  }, { body: AddCrowdStrikeSchema })

  /**
   * Add AI provider integration (Gemini, OpenAI, etc.)
   * @route POST /integrations/ai/:provider
   * @access Protected - Admin only
   * @param {string} provider - AI provider (gemini, openai, anthropic)
   * @body {string} apiKey - Provider API key
   * @body {string} model - Model name (optional)
   * @body {string} baseUrl - Custom base URL (optional)
   * @returns {Object} Created AI integration
   */
  .post('/ai/:provider', async ({ user, params, body, set }: any) => {
    try {
      if (!user?.tenantId) throw new Error('Unauthorized')
      const { apiKey, model, baseUrl, label } = body as AddAIBody
      const provider = params.provider.toLowerCase()
      if (!apiKey) throw new Error('API Key is required')
      return await IntegrationService.addAI(user.tenantId as string, provider, {
        apiKey,
        model,
        baseUrl,
        label
      })
    } catch (e: any) {
      set.status = 400
      return { error: e.message }
    }
  }, { body: AddAISchema })

  /**
   * Add AWS CloudTrail integration
   * @route POST /integrations/aws
   * @access Protected - Admin only
   * @body {string} accessKeyId - AWS access key
   * @body {string} secretAccessKey - AWS secret key
   * @body {string} region - AWS region
   * @returns {Object} Created AWS integration
   */
  .post('/aws', async ({ user, body, set }: any) => {
    try {
      if (!user?.tenantId) throw new Error('Unauthorized')
      // @ts-ignore
      const integration = await IntegrationService.addAWS(user.tenantId as string, body)
      set.status = 201
      return { message: 'AWS integration added successfully', integration }
    } catch (e: any) {
      set.status = 400
      return { error: e.message }
    }
  }, { body: AddAWSSchema })

  /**
   * Manually trigger AWS CloudTrail sync
   * @route POST /integrations/aws/sync
   * @access Protected - Admin only
   * @returns {Object} Sync result
   */
  .post('/aws/sync', async ({ user, set }: any) => {
    try {
      if (!user?.tenantId) throw new Error('Unauthorized')
      const result = await IntegrationService.syncAWS(user.tenantId as string)
      return { message: 'AWS CloudTrail Sync Complete', result }
    } catch (e: any) {
      set.status = 500
      return { error: e.message }
    }
  })

  /**
   * Add threat intelligence enrichment provider
   * @route POST /integrations/enrichment/:provider  
   * @access Protected - Admin only
   * @param {string} provider - Provider (virustotal, abuseipdb, alienvault-otx)
   * @body {string} apiKey - Provider API key
   * @returns {Object} Created enrichment integration
   */
  .post('/enrichment/:provider', async ({ user, params, body, set }: any) => {
    try {
      if (!user?.tenantId) throw new Error('Unauthorized')
      const { apiKey, label } = body as { apiKey: string; label?: string }
      const provider = params.provider.toLowerCase()

      if (!apiKey) throw new Error('API Key is required')
      
      // Normalize provider name: alienvault -> alienvault-otx
      let normalizedProvider = provider
      if (provider === 'alienvault') {
        normalizedProvider = 'alienvault-otx'
      }
      
      if (!['virustotal', 'abuseipdb', 'alienvault-otx'].includes(normalizedProvider)) {
        throw new Error('Invalid enrichment provider. Must be virustotal, abuseipdb, or alienvault')
      }

      const defaultLabels: Record<string, string> = {
        'virustotal': 'VirusTotal',
        'abuseipdb': 'AbuseIPDB',
        'alienvault-otx': 'AlienVault OTX'
      }

      return await IntegrationService.addEnrichment(user.tenantId as string, normalizedProvider, {
        apiKey,
        label: label || defaultLabels[normalizedProvider] || normalizedProvider
      })
    } catch (e: any) {
      console.error('[Enrichment Add Error]', e.message, e.stack)
      set.status = 400
      return { error: e.message }
    }
  })
  
  /**
   * Add ticketing integration (Jira/ServiceNow)
   * @route POST /integrations/ticketing/:provider
   */
  .post('/ticketing/:provider', async ({ user, params, body, set }: any) => {
      try {
          if (!user?.tenantId) throw new Error('Unauthorized');
          const provider = params.provider.toLowerCase();
          if (!['jira', 'servicenow'].includes(provider)) throw new Error('Invalid provider');
          
          return await IntegrationService.addTicketing(user.tenantId, provider, body);
      } catch (e: any) {
          set.status = 400;
          return { error: e.message };
      }
  })

  /**
   * Get integration configuration (for editing)
   * @route GET /integrations/:id/config
   * @access Protected - Admin only
   * @param {string} id - Integration ID
   * @returns {Object} Integration configuration (credentials masked)
   */
  .get('/:id/config', async ({ params, user, set }: any) => {
    try {
      if (!user?.tenantId) throw new Error('Unauthorized')
      const config = await IntegrationService.getConfig(params.id, user.tenantId as string)
      return config
    } catch (e: any) {
      set.status = 400
      return { error: e.message }
    }
  })

  /**
   * Update integration configuration
   * @route PUT /integrations/:id
   * @access Protected - Admin only
   * @param {string} id - Integration ID
   * @body {object} Updated configuration
   * @returns {Object} Updated integration
   * @description Triggers collector reload after update
   */
  .put('/:id', async ({ params, body, user, set }: any) => {
    try {
      if (!user?.tenantId) throw new Error('Unauthorized')
      const integration = await IntegrationService.updateFull(params.id, user.tenantId as string, body as any)
      
      // Trigger collector to reload config
      const collectorUrl = process.env.COLLECTOR_URL || 'http://localhost:8001'
      try {
        await fetch(`${collectorUrl}/sync/${params.id}`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'x-collector-key': COLLECTOR_API_KEY 
          },
        })
        console.log(`[Integration Update] Triggered Collector sync for integration ${params.id}`)
      } catch (e) {
        console.warn('[Integration Update] Failed to trigger Collector sync:', e)
      }
      
      return { message: 'Integration updated successfully', integration }
    } catch (e: any) {
      set.status = 400
      return { error: e.message }
    }
  })

  /**
   * Delete integration
   * @route DELETE /integrations/:id
   * @access Protected - Admin only
   * @param {string} id - Integration ID
   * @returns {Object} Success message
   * @description Notifies collector to stop syncing before deletion
   */
  .delete('/:id', async ({ params, user, set }: any) => {
    try {
      if (!user?.tenantId) throw new Error('Unauthorized')
      // Notify collector to cancel sync
      const collectorUrl = process.env.COLLECTOR_URL || 'http://localhost:8001'
      try {
        await fetch(`${collectorUrl}/sync/${params.id}`, {
          method: 'DELETE',
          headers: { 'x-collector-key': COLLECTOR_API_KEY },
        })
      } catch (e) {
        console.warn('Failed to notify collector about integration deletion:', e)
      }
      await IntegrationService.delete(params.id, user.tenantId as string)
      return { message: 'Integration deleted successfully' }
    } catch (e: any) {
      set.status = 400
      return { error: e.message }
    }
  })

  /**
   * Test integration connection
   * @route POST /integrations/:id/test
   * @access Protected - Admin only
   * @param {string} id - Integration ID
   * @returns {Object} Connection test result
   * @throws {400} Connection failed
   */
  .post('/:id/test', async ({ params, user, set }: any) => {
    try {
      if (!user?.tenantId) throw new Error('Unauthorized')
      await IntegrationService.testExisting(params.id, user.tenantId as string)
      return { message: 'Connection verification successful', status: 'connected' }
    } catch (e: any) {
      set.status = 400
      return { error: e.message, status: 'disconnected' }
    }
  })

  /**
   * Get health status of all integrations for the tenant
   * @route GET /integrations/health
   */
  .get('/health', async ({ user, set }: any) => {
    try {
      if (!user?.tenantId) throw new Error('Unauthorized')
      return await IntegrationService.getHealthSummary(user.tenantId as string)
    } catch (e: any) {
      set.status = 400
      return { error: e.message }
    }
  })

  /**
   * Manually reset the circuit breaker for an integration
   * @route POST /integrations/:id/reset-circuit
   */
  .post('/:id/reset-circuit', async ({ params, user, set }: any) => {
    try {
      if (!user?.tenantId) throw new Error('Unauthorized')
      await IntegrationService.resetCircuit(params.id, user.tenantId as string)
      return { success: true, message: 'Circuit breaker reset successfully' }
    } catch (e: any) {
      set.status = 400
      return { error: e.message }
    }
  })
