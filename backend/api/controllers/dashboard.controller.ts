/**
 * Dashboard Controller
 * Provides analytics and metrics data for security operations dashboard
 * Includes: Summary stats, timelines, top entities, MITRE ATT&CK heatmaps
 */

import { Elysia } from 'elysia'
import { jwt } from '@elysiajs/jwt'
import { DashboardService } from '../core/services/dashboard.service'
import { DashboardLayoutService } from '../core/services/dashboard-layout.service'
import { ActivityService } from '../core/services/activity.service'
import { tenantAdminOnly } from '../middlewares/auth.middleware'
import { SchedulerService } from '../core/services/scheduler.service'

// Helper: Get effective tenantId (supports superadmin impersonation)
const getEffectiveTenantId = (payload: any, selectedTenant: { value?: unknown } | undefined): string => {
  if (payload.role === 'superadmin') {
    if (selectedTenant?.value) {
      return String(selectedTenant.value)
    }
    // Fallback to user's tenant ID (likely the main tenant with data) if no specific tenant selected
    return payload.tenantId || 'c8abd753-3015-4508-aa7b-6bcf732934e5'
  }
  
  if (!payload.tenantId) {
    throw new Error('No tenant selected. Super Admin must select a tenant first.')
  }
  return payload.tenantId as string
}

// Helper: Parse date range from query params
const parseDateRange = (query: any): { startDate: string, endDate: string } => {
  const today = new Date()
  let startDate: string, endDate: string
  
  if (query.startDate && query.endDate) {
    startDate = query.startDate as string
    endDate = query.endDate as string
  } else {
    const days = parseInt(query.days as string) || 7
    const start = new Date(today)
    start.setDate(start.getDate() - days)
    startDate = start.toISOString().split('T')[0]
    endDate = today.toISOString().split('T')[0]
  }
  
  return { startDate, endDate }
}

export const dashboardController = new Elysia({ prefix: '/dashboard' })
  .use(jwt({
    name: 'jwt',
    secret: process.env.JWT_SECRET || 'super_secret_dev_key',
  }))
  .use(tenantAdminOnly)

  /**
   * Get user's dashboard layout configuration
   * @route GET /dashboard/layout
   * @access Protected - Requires authentication
   * @returns {Object} Saved dashboard widget layout
   */
  .get('/layout', async ({ jwt, cookie: { access_token }, set }) => {
    try {
      const payload = await jwt.verify(access_token.value as string)
      if (!payload) throw new Error('Unauthorized')
      
      return await DashboardLayoutService.getLayout(payload.id as string)
    } catch (e: any) {
      set.status = 400
      return { error: e.message }
    }
  })

  /**
   * Save dashboard layout configuration
   * @route PUT /dashboard/layout
   * @access Protected - Requires authentication  
   * @body {array} layout - Widget layout configuration
   * @returns {Object} Saved layout
   */
  .put('/dashboard/layout', async ({ jwt, cookie: { access_token }, body, set }) => {
    try {
      const payload = await jwt.verify(access_token.value as string)
      if (!payload) throw new Error('Unauthorized')

      return await DashboardLayoutService.saveLayout(payload.id as string, body as any[])
    } catch (e: any) {
      set.status = 400
      return { error: e.message }
    }
  })

  /**
   * Trigger manual database optimization
   * @route POST /dashboard/optimize
   * @access Protected - Admin only
   * @query {boolean} full - Full optimization including MV refresh
   * @returns {Object} Optimization result
   * @todo Implement actual optimization logic
   */
  .post('/optimize', async ({ jwt, cookie: { access_token }, set, query }) => {
    try {
      const payload = await jwt.verify(access_token.value as string)
      if (!payload) throw new Error('Unauthorized')

      if (query.full === 'true') {
        return { message: 'Full optimization (MV repopulation) - not yet implemented' }
      } else {
        return { message: 'Optimization - not yet implemented' }
      }
    } catch (e: any) {
      set.status = 400
      return { error: e.message }
    }
  })

  /**
   * Seed test data (development only)
   * @route POST /dashboard/seed
   * @access Protected
   * @body {string} tenantId - Tenant ID
   * @body {string} severity - Event severity
   * @returns {Object} Created event ID
   * @warning Development/testing only - not for production use
   */
  .post('/seed', async ({ body, set }) => {
      try {
        const { tenantId, severity } = body as any
        const id = crypto.randomUUID()
        const sql = `
            INSERT INTO security_events (
                id, tenant_id, timestamp, severity, source, event_type,
                host_name, user_name, mitre_tactic, mitre_technique
            ) VALUES (
                '${id}', '${tenantId}', now(), '${severity}', 'simulation', 'alert',
                'host-1', 'user-1', 'Initial Access', 'T1078'
            )
        `
        
        await import('../infra/clickhouse/client').then(m => m.clickhouse.command({ query: sql }))
        
        return { success: true, id }
      } catch (e: any) {
         console.error('Seed error:', e)
         set.status = 500
         return { error: e.message }
      }
  })

  /**
   * Get dashboard summary  metrics
   * @route GET /dashboard/summary
   * @access Protected - Requires authentication
   * @query {string} startDate - Start date (YYYY-MM-DD)
   * @query {string} endDate - End date (YYYY-MM-DD)
   * @query {string} sources - Comma-separated source filters
   * @returns {Object} Summary metrics (total events, by severity, trends)
   */
  .get('/summary', async ({ jwt, cookie: { access_token, selected_tenant }, query, set }) => {
    try {
      const payload = await jwt.verify(access_token.value as string)
      if (!payload) throw new Error('Unauthorized')

      const tenantId = getEffectiveTenantId(payload, selected_tenant)
      const { startDate, endDate } = parseDateRange(query)
      
      let sources: string[] | undefined = undefined
      if (query.sources) {
        sources = typeof query.sources === 'string' 
          ? query.sources.split(',').filter(Boolean)
          : Array.isArray(query.sources) ? query.sources : undefined
      } else if (query.source) {
        sources = [query.source as string]
      }

      return await DashboardService.getSummary(tenantId, startDate, endDate, sources)
    } catch (e: any) {
      console.error('Dashboard summary error:', e)
      set.status = 400
      return { error: e.message }
    }
  })

  /**
   * Get timeline data for chart visualization
   * @route GET /dashboard/timeline
   * @access Protected - Requires authentication
   * @query {string} interval - Time interval (hour/day)
   * @query {string} sources - Source filters
   * @returns {Object} Time series data points
   */
  .get('/timeline', async ({ jwt, cookie: { access_token, selected_tenant }, query, set }) => {
    try {
      const payload = await jwt.verify(access_token.value as string)
      if (!payload) throw new Error('Unauthorized')

      const tenantId = getEffectiveTenantId(payload, selected_tenant)
      const { startDate, endDate } = parseDateRange(query)
      const interval = (query.interval as 'hour' | 'day') || 'day'
      
      let sources: string[] | undefined = undefined
      if (query.sources) {
        sources = typeof query.sources === 'string' 
          ? query.sources.split(',').filter(Boolean)
          : Array.isArray(query.sources) ? query.sources : undefined
      } else if (query.source) {
        sources = [query.source as string]
      }

      return await DashboardService.getTimeline(tenantId, startDate, endDate, interval, sources)
    } catch (e: any) {
      set.status = 400
      return { error: e.message }
    }
  })

  /**
   * Get top affected hosts
   * @route GET /dashboard/top-hosts
   * @access Protected - Requires authentication
   * @query {number} limit - Max results (default: 10)
   * @returns {Object} List of hosts with event counts
   */
  .get('/top-hosts', async ({ jwt, cookie: { access_token, selected_tenant }, query, set }) => {
    try {
      const payload = await jwt.verify(access_token.value as string)
      if (!payload) throw new Error('Unauthorized')

      const tenantId = getEffectiveTenantId(payload, selected_tenant)
      const { startDate, endDate } = parseDateRange(query)
      const limit = parseInt(query.limit as string) || 10
      
      let sources: string[] | undefined = undefined
      if (query.sources) {
        sources = typeof query.sources === 'string' 
          ? query.sources.split(',').filter(Boolean)
          : Array.isArray(query.sources) ? query.sources : undefined
      } else if (query.source) {
        sources = [query.source as string]
      }

      return await DashboardService.getTopHosts(tenantId, startDate, endDate, limit, sources)
    } catch (e: any) {
      set.status = 400
      return { error: e.message }
    }
  })

  /**
   * Get top affected users
   * @route GET /dashboard/top-users
   * @access Protected - Requires authentication
   * @query {number} limit - Max results (default: 10)
   * @returns {Object} List of users with event counts
   */
  .get('/top-users', async ({ jwt, cookie: { access_token, selected_tenant }, query, set }) => {
    try {
      const payload = await jwt.verify(access_token.value as string)
      if (!payload) throw new Error('Unauthorized')

      const tenantId = getEffectiveTenantId(payload, selected_tenant)
      const { startDate, endDate } = parseDateRange(query)
      const limit = parseInt(query.limit as string) || 10
      
      let sources: string[] | undefined = undefined
      if (query.sources) {
        sources = typeof query.sources === 'string' 
          ? query.sources.split(',').filter(Boolean)
          : Array.isArray(query.sources) ? query.sources : undefined
      } else if (query.source) {
        sources = [query.source as string]
      }

      return await DashboardService.getTopUsers(tenantId, startDate, endDate, limit, sources)
    } catch (e: any) {
      set.status = 400
      return { error: e.message }
    }
  })

  /**
   * Get MITRE ATT&CK technique heatmap
   * @route GET /dashboard/mitre-heatmap
   * @access Protected - Requires authentication
   * @returns {Object} MITRE techniques with frequency counts
   */
  .get('/mitre-heatmap', async ({ jwt, cookie: { access_token, selected_tenant }, query, set }) => {
    try {
      const payload = await jwt.verify(access_token.value as string)
      if (!payload) throw new Error('Unauthorized')

      const tenantId = getEffectiveTenantId(payload, selected_tenant)
      const { startDate, endDate } = parseDateRange(query)
      const mode = (query.mode as 'detection' | 'coverage') || 'detection'
      
      let sources: string[] | undefined = undefined
      if (query.sources) {
        sources = typeof query.sources === 'string' 
          ? query.sources.split(',').filter(Boolean)
          : Array.isArray(query.sources) ? query.sources : undefined
      } else if (query.source) {
        sources = [query.source as string]
      }

      return await DashboardService.getMitreHeatmap(tenantId, startDate, endDate, sources, mode)
    } catch (e: any) {
      set.status = 400
      return { error: e.message }
    }
  })

  /**
   * Get event source breakdown
   * @route GET /dashboard/sources
   * @access Protected - Requires authentication
   * @returns {Object} Event counts by source
   */
  .get('/sources', async ({ jwt, cookie: { access_token, selected_tenant }, query, set }) => {
    try {
      const payload = await jwt.verify(access_token.value as string)
      if (!payload) throw new Error('Unauthorized')

      const tenantId = getEffectiveTenantId(payload, selected_tenant)
      const { startDate, endDate } = parseDateRange(query)
      
      let sources: string[] | undefined = undefined
      if (query.sources) {
        sources = typeof query.sources === 'string' 
          ? query.sources.split(',').filter(Boolean)
          : Array.isArray(query.sources) ? query.sources : undefined
      } else if (query.source) {
        sources = [query.source as string]
      }

      return await DashboardService.getSourcesBreakdown(tenantId, startDate, endDate, sources)
    } catch (e: any) {
      set.status = 400
      return { error: e.message }
    }
  })

  /**
   * Get integration-specific metrics
   * @route GET /dashboard/integrations
   * @access Protected - Requires authentication
   * @returns {Object} Metrics by integration
   */
  .get('/integrations', async ({ jwt, cookie: { access_token, selected_tenant }, query, set }) => {
    try {
      const payload = await jwt.verify(access_token.value as string)
      if (!payload) throw new Error('Unauthorized')

      const tenantId = getEffectiveTenantId(payload, selected_tenant)
      const { startDate, endDate } = parseDateRange(query)
      
      let sources: string[] | undefined = undefined
      if (query.sources) {
        sources = typeof query.sources === 'string' 
          ? query.sources.split(',').filter(Boolean)
          : Array.isArray(query.sources) ? query.sources : undefined
      } else if (query.source) {
        sources = [query.source as string]
      }

      return await DashboardService.getIntegrationBreakdown(tenantId, startDate, endDate, sources)
    } catch (e: any) {
      set.status = 400
      return { error: e.message }
    }
  })

  /**
   * Get site/location breakdown
   * @route GET /dashboard/sites
   * @access Protected - Requires authentication
   * @returns {Object} Metrics by site
   */
  .get('/sites', async ({ jwt, cookie: { access_token, selected_tenant }, query, set }) => {
    try {
      const payload = await jwt.verify(access_token.value as string)
      if (!payload) throw new Error('Unauthorized')

      const tenantId = getEffectiveTenantId(payload, selected_tenant)
      const { startDate, endDate } = parseDateRange(query)
      
      let sources: string[] | undefined = undefined
      if (query.sources) {
        sources = typeof query.sources === 'string' 
          ? query.sources.split(',').filter(Boolean)
          : Array.isArray(query.sources) ? query.sources : undefined
      } else if (query.source) {
        sources = [query.source as string]
      }

      return await DashboardService.getSiteBreakdown(tenantId, startDate, endDate, sources)
    } catch (e: any) {
      set.status = 400
      return { error: e.message }
    }
  })

  /**
   * Get summary for specific integration
   * @route GET /dashboard/summary/integration/:integrationId
   * @access Protected - Requires authentication
   * @param {string} integrationId - Integration ID
   * @query {number} days - Number of days (default: 7)
   * @returns {Object} Integration-specific metrics
   */
  .get('/summary/integration/:integrationId', async ({ jwt, cookie: { access_token, selected_tenant }, params, query, set }) => {
    try {
      const payload = await jwt.verify(access_token.value as string)
      if (!payload) throw new Error('Unauthorized')

      const tenantId = getEffectiveTenantId(payload, selected_tenant)
      const days = parseInt(query.days as string) || 7
      return await DashboardService.getSummaryByIntegration(tenantId, params.integrationId, days)
    } catch (e: any) {
      set.status = 400
      return { error: e.message }
    }
  })

  /**
   * Get summary for specific site
   * @route GET /dashboard/summary/site/:siteName
   * @access Protected - Requires authentication
   * @param {string} siteName - Site name (URL encoded)
   * @query {number} days - Number of days (default: 7)
   * @returns {Object} Site-specific metrics
   */
  .get('/summary/site/:siteName', async ({ jwt, cookie: { access_token, selected_tenant }, params, query, set }) => {
    try {
      const payload = await jwt.verify(access_token.value as string)
      if (!payload) throw new Error('Unauthorized')

      const tenantId = getEffectiveTenantId(payload, selected_tenant)
      const days = parseInt(query.days as string) || 7
      return await DashboardService.getSummaryBySite(tenantId, decodeURIComponent(params.siteName), days)
    } catch (e: any) {
      set.status = 400
      return { error: e.message }
    }
  })

  /**
   * Get recent security detections
   * @route GET /dashboard/recent-detections
   * @access Protected - Requires authentication
   * @query {number} limit - Max results (default: 5)
   * @returns {Object} Recent detection events
   */
  .get('/recent-detections', async ({ jwt, cookie: { access_token, selected_tenant }, query, set }) => {
    try {
      const payload = await jwt.verify(access_token.value as string)
      if (!payload) throw new Error('Unauthorized')

      const tenantId = getEffectiveTenantId(payload, selected_tenant)
      const { startDate, endDate } = parseDateRange(query)
      const limit = parseInt(query.limit as string) || 5
      
      let sources: string[] | undefined = undefined
      if (query.sources) {
        sources = typeof query.sources === 'string' 
          ? query.sources.split(',').filter(Boolean)
          : Array.isArray(query.sources) ? query.sources : undefined
      } else if (query.source) {
        sources = [query.source as string]
      }

      return await DashboardService.getRecentDetections(tenantId, startDate, endDate, limit, sources)
    } catch (e: any) {
      set.status = 400
      return { error: e.message }
    }
  })

  /**
   * Get activity feed (user actions, system events)
   * @route GET /dashboard/activity
   * @access Protected - Requires authentication
   * @query {number} limit - Max results (default: 20)
   * @returns {Object} Recent activity feed
   */
  .get('/activity', async ({ jwt, cookie: { access_token, selected_tenant }, query, set }) => {
    try {
      const payload = await jwt.verify(access_token.value as string)
      if (!payload) throw new Error('Unauthorized')

      const tenantId = getEffectiveTenantId(payload, selected_tenant)
      const limit = parseInt(query.limit as string) || 20
      
      return await ActivityService.getRecentActivity(tenantId, limit)
    } catch (e: any) {
      set.status = 400
      return { error: e.message }
    }
  })
