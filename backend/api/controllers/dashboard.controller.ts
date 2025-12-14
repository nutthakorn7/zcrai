import { Elysia } from 'elysia'
import { jwt } from '@elysiajs/jwt'
import { DashboardService } from '../core/services/dashboard.service'
import { DashboardLayoutService } from '../core/services/dashboard-layout.service'
import { tenantAdminOnly } from '../middlewares/auth.middleware'

import { SchedulerService } from '../core/services/scheduler.service'

// Helper: Get effective tenantId (supports superadmin impersonation)
const getEffectiveTenantId = (payload: any, selectedTenant: any): string => {
  // If superadmin and has selected tenant, use that
  if (payload.role === 'superadmin' && selectedTenant?.value) {
    return selectedTenant.value
  }
  // Otherwise use user's own tenantId
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
    // Fallback: use days parameter
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

  // ==================== LAYOUT ====================
  .get('/layout', async ({ jwt, cookie: { access_token }, set }) => {
    try {
      const payload = await jwt.verify(access_token.value)
      if (!payload) throw new Error('Unauthorized')
      
      // Layout is user-specific, not tenant-specific (even for superadmin impersonating)
      // Though if we want "Tenant Default", we might need logic. 
      // For now, per-user layout.
      return await DashboardLayoutService.getLayout(payload.id as string)
    } catch (e: any) {
      set.status = 400
      return { error: e.message }
    }
  })

  .put('/layout', async ({ jwt, cookie: { access_token }, body, set }) => {
    try {
      const payload = await jwt.verify(access_token.value)
      if (!payload) throw new Error('Unauthorized')

      return await DashboardLayoutService.saveLayout(payload.id as string, body as any[])
    } catch (e: any) {
      set.status = 400
      return { error: e.message }
    }
  })

  // ==================== OPTIMIZE DB (Manual Trigger) ====================
  .post('/optimize', async ({ jwt, cookie: { access_token }, set, query }) => {
    try {
      const payload = await jwt.verify(access_token.value)
      if (!payload) throw new Error('Unauthorized')

      if (query.full === 'true') {
        SchedulerService.repopulateMVs()
        return { message: 'Full optimization (MV repopulation) started in background' }
      } else {
        SchedulerService.optimizeDB()
        return { message: 'Optimization started in background' }
      }
    } catch (e: any) {
      set.status = 400
      return { error: e.message }
    }
  })

  // ==================== SUMMARY ====================
  .get('/summary', async ({ jwt, cookie: { access_token, selected_tenant }, query, set }) => {
    try {
      const payload = await jwt.verify(access_token.value)
      if (!payload) throw new Error('Unauthorized')

      const tenantId = getEffectiveTenantId(payload, selected_tenant)
      const { startDate, endDate } = parseDateRange(query)
      
      // Parse sources from comma-separated string or array
      let sources: string[] | undefined = undefined
      if (query.sources) {
        sources = typeof query.sources === 'string' 
          ? query.sources.split(',').filter(Boolean)
          : Array.isArray(query.sources) ? query.sources : undefined
      } else if (query.source) {
        // Fallback for backward compatibility
        sources = [query.source as string]
      }

      return await DashboardService.getSummary(tenantId, startDate, endDate, sources)
    } catch (e: any) {
      set.status = 400
      return { error: e.message }
    }
  })

  // ==================== TIMELINE ====================
  .get('/timeline', async ({ jwt, cookie: { access_token, selected_tenant }, query, set }) => {
    try {
      const payload = await jwt.verify(access_token.value)
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

  // ==================== TOP HOSTS ====================
  .get('/top-hosts', async ({ jwt, cookie: { access_token, selected_tenant }, query, set }) => {
    try {
      const payload = await jwt.verify(access_token.value)
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

  // ==================== TOP USERS ====================
  .get('/top-users', async ({ jwt, cookie: { access_token, selected_tenant }, query, set }) => {
    try {
      const payload = await jwt.verify(access_token.value)
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

  // ==================== MITRE HEATMAP ====================
  .get('/mitre-heatmap', async ({ jwt, cookie: { access_token, selected_tenant }, query, set }) => {
    try {
      const payload = await jwt.verify(access_token.value)
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

      return await DashboardService.getMitreHeatmap(tenantId, startDate, endDate, sources)
    } catch (e: any) {
      set.status = 400
      return { error: e.message }
    }
  })

  // ==================== SOURCES BREAKDOWN ====================
  .get('/sources', async ({ jwt, cookie: { access_token, selected_tenant }, query, set }) => {
    try {
      const payload = await jwt.verify(access_token.value)
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

  // ==================== INTEGRATIONS BREAKDOWN ====================
  .get('/integrations', async ({ jwt, cookie: { access_token, selected_tenant }, query, set }) => {
    try {
      const payload = await jwt.verify(access_token.value)
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

  // ==================== SITES BREAKDOWN ====================
  .get('/sites', async ({ jwt, cookie: { access_token, selected_tenant }, query, set }) => {
    try {
      const payload = await jwt.verify(access_token.value)
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

  // ==================== SUMMARY BY INTEGRATION ====================
  .get('/summary/integration/:integrationId', async ({ jwt, cookie: { access_token, selected_tenant }, params, query, set }) => {
    try {
      const payload = await jwt.verify(access_token.value)
      if (!payload) throw new Error('Unauthorized')

      const tenantId = getEffectiveTenantId(payload, selected_tenant)
      const days = parseInt(query.days as string) || 7
      return await DashboardService.getSummaryByIntegration(tenantId, params.integrationId, days)
    } catch (e: any) {
      set.status = 400
      return { error: e.message }
    }
  })

  // ==================== SUMMARY BY SITE ====================
  .get('/summary/site/:siteName', async ({ jwt, cookie: { access_token, selected_tenant }, params, query, set }) => {
    try {
      const payload = await jwt.verify(access_token.value)
      if (!payload) throw new Error('Unauthorized')

      const tenantId = getEffectiveTenantId(payload, selected_tenant)
      const days = parseInt(query.days as string) || 7
      return await DashboardService.getSummaryBySite(tenantId, decodeURIComponent(params.siteName), days)
    } catch (e: any) {
      set.status = 400
      return { error: e.message }
    }
  })

  // ==================== RECENT DETECTIONS ====================
  .get('/recent-detections', async ({ jwt, cookie: { access_token, selected_tenant }, query, set }) => {
    try {
      const payload = await jwt.verify(access_token.value)
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
