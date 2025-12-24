import { Elysia, t } from 'elysia'
import { DashboardService } from '../core/services/dashboard.service'
import { DashboardLayoutService } from '../core/services/dashboard-layout.service'
import { ActivityService } from '../core/services/activity.service'
import { SLAService } from '../core/services/sla.service'
import { withAuth } from '../middleware/auth'

// Helper: Get effective tenantId (supports superadmin impersonation)
const getEffectiveTenantId = (user: any, selectedTenant: { value?: unknown } | undefined): string => {
  if (user.role === 'superadmin') {
    if (selectedTenant?.value) {
      return String(selectedTenant.value)
    }
    // Fallback to system tenant ID for superadmin view (main demo tenant with data)
    return '03c703a2-6731-4306-9a39-e68070415069'
  }
  
  if (!user.tenantId) {
    throw new Error('No tenant selected. Super Admin must select a tenant first.')
  }
  return user.tenantId as string
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
  .use(withAuth)

  /**
   * Get user's dashboard layout configuration
   */
  .get('/layout', async ({ user, set }) => {
    try {
      return await DashboardLayoutService.getLayout(user.id)
    } catch (e: any) {
      set.status = 400
      return { error: e.message }
    }
  })

  /**
   * Save dashboard layout configuration
   */
  .put('/layout', async ({ user, body, set }) => {
    try {
      return await DashboardLayoutService.saveLayout(user.id, body as any[])
    } catch (e: any) {
      set.status = 400
      return { error: e.message }
    }
  })

  /**
   * Get dashboard summary metrics
   */
  .get('/summary', async ({ user, cookie: { selected_tenant }, query, set }) => {
    try {
      console.log(`[DashboardController] GET /summary called for user: ${user.email}`);
      const tenantId = getEffectiveTenantId(user, selected_tenant)
      const { startDate, endDate } = parseDateRange(query)
      
      let sources: string[] | undefined = undefined
      if (query.sources) {
        sources = typeof query.sources === 'string' 
          ? query.sources.split(',').filter(Boolean)
          : Array.isArray(query.sources) ? query.sources : undefined
      }

      return await DashboardService.getSummary(tenantId, startDate, endDate, sources)
    } catch (e: any) {
      set.status = 400
      return { error: e.message }
    }
  })

  /**
   * Get timeline data
   */
  .get('/timeline', async ({ user, cookie: { selected_tenant }, query, set }) => {
    try {
      const tenantId = getEffectiveTenantId(user, selected_tenant)
      const { startDate, endDate } = parseDateRange(query)
      const interval = (query.interval as 'hour' | 'day') || 'day'
      
      let sources: string[] | undefined = undefined
      if (query.sources) {
        sources = typeof query.sources === 'string' 
          ? query.sources.split(',').filter(Boolean)
          : Array.isArray(query.sources) ? query.sources : undefined
      }

      return await DashboardService.getTimeline(tenantId, startDate, endDate, interval, sources)
    } catch (e: any) {
      set.status = 400
      return { error: e.message }
    }
  })

  /**
   * Get top hosts
   */
  .get('/top-hosts', async ({ user, cookie: { selected_tenant }, query, set }) => {
    try {
      const tenantId = getEffectiveTenantId(user, selected_tenant)
      const { startDate, endDate } = parseDateRange(query)
      const limit = parseInt(query.limit as string) || 10
      
      let sources: string[] | undefined = undefined
      if (query.sources) {
        sources = typeof query.sources === 'string' 
          ? query.sources.split(',').filter(Boolean)
          : Array.isArray(query.sources) ? query.sources : undefined
      }

      return await DashboardService.getTopHosts(tenantId, startDate, endDate, limit, sources)
    } catch (e: any) {
      set.status = 400
      return { error: e.message }
    }
  })

  /**
   * Get top users
   */
  .get('/top-users', async ({ user, cookie: { selected_tenant }, query, set }) => {
    try {
      const tenantId = getEffectiveTenantId(user, selected_tenant)
      const { startDate, endDate } = parseDateRange(query)
      const limit = parseInt(query.limit as string) || 10
      
      let sources: string[] | undefined = undefined
      if (query.sources) {
        sources = typeof query.sources === 'string' 
          ? query.sources.split(',').filter(Boolean)
          : Array.isArray(query.sources) ? query.sources : undefined
      }

      return await DashboardService.getTopUsers(tenantId, startDate, endDate, limit, sources)
    } catch (e: any) {
      set.status = 400
      return { error: e.message }
    }
  })

  /**
   * Get MITRE heatmap
   */
  .get('/mitre-heatmap', async ({ user, cookie: { selected_tenant }, query, set }) => {
    try {
      const tenantId = getEffectiveTenantId(user, selected_tenant)
      const { startDate, endDate } = parseDateRange(query)
      const mode = (query.mode as 'detection' | 'coverage') || 'detection'
      
      let sources: string[] | undefined = undefined
      if (query.sources) {
        sources = typeof query.sources === 'string' 
          ? query.sources.split(',').filter(Boolean)
          : Array.isArray(query.sources) ? query.sources : undefined
      }

      return await DashboardService.getMitreHeatmap(tenantId, startDate, endDate, sources, mode)
    } catch (e: any) {
      set.status = 400
      return { error: e.message }
    }
  })

  /**
   * Other endpoints updated to use 'user' context
   */
  .get('/sources', async ({ user, cookie: { selected_tenant }, query, set }) => {
    try {
      const tenantId = getEffectiveTenantId(user, selected_tenant)
      const { startDate, endDate } = parseDateRange(query)
      return await DashboardService.getSourcesBreakdown(tenantId, startDate, endDate)
    } catch (e: any) {
      set.status = 400
      return { error: e.message }
    }
  })

  .get('/integrations', async ({ user, cookie: { selected_tenant }, query, set }) => {
    try {
      const tenantId = getEffectiveTenantId(user, selected_tenant)
      const { startDate, endDate } = parseDateRange(query)
      return await DashboardService.getIntegrationBreakdown(tenantId, startDate, endDate)
    } catch (e: any) {
      set.status = 400
      return { error: e.message }
    }
  })

  .get('/sites', async ({ user, cookie: { selected_tenant }, query, set }) => {
    try {
      const tenantId = getEffectiveTenantId(user, selected_tenant)
      const { startDate, endDate } = parseDateRange(query)
      return await DashboardService.getSiteBreakdown(tenantId, startDate, endDate)
    } catch (e: any) {
      set.status = 400
      return { error: e.message }
    }
  })

  .get('/recent-detections', async ({ user, cookie: { selected_tenant }, query, set }) => {
    try {
      const tenantId = getEffectiveTenantId(user, selected_tenant)
      const { startDate, endDate } = parseDateRange(query)
      const limit = parseInt(query.limit as string) || 5
      return await DashboardService.getRecentDetections(tenantId, startDate, endDate, limit)
    } catch (e: any) {
      set.status = 400
      return { error: e.message }
    }
  })

  .get('/activity', async ({ user, cookie: { selected_tenant }, query, set }) => {
    try {
      const tenantId = getEffectiveTenantId(user, selected_tenant)
      const limit = parseInt(query.limit as string) || 20
      return await ActivityService.getRecentActivity(tenantId, limit)
    } catch (e: any) {
      set.status = 400
      return { error: e.message }
    }
  })

  .get('/ai-metrics', async ({ user, set }) => {
    try {
      if (!user?.tenantId) throw new Error('Tenant context required');
      return await DashboardService.getAIMetrics(user.tenantId)
    } catch (e: any) {
      set.status = 400
      return { error: e.message }
    }
  })

  .get('/ai-feedback', async ({ user, set }) => {
    try {
      if (!user?.tenantId) throw new Error('Tenant context required');
      return await DashboardService.getFeedbackMetrics(user.tenantId)
    } catch (e: any) {
      set.status = 400
      return { error: e.message }
    }
  })

  .get('/performance', async ({ user, cookie: { selected_tenant }, set }) => {
    try {
      const tenantId = getEffectiveTenantId(user, selected_tenant)
      return await DashboardService.getPerformanceMetrics(tenantId)
    } catch (e: any) {
      set.status = 400
      return { error: e.message }
    }
  })

  .get('/sla', async ({ user, cookie: { selected_tenant }, query, set }) => {
    try {
      const tenantId = getEffectiveTenantId(user, selected_tenant)
      const days = typeof query.days === 'string' ? parseInt(query.days) : 30
      const stats = await SLAService.getSLUMetrics(tenantId)
      const trend = await SLAService.getSLATrend(tenantId, days)
      return { success: true, stats, trend }
    } catch (e: any) {
      set.status = 400
      return { error: e.message }
    }
  }, {
    query: t.Object({
        days: t.Optional(t.String())
    })
  })
