import { Elysia } from 'elysia'
import { jwt } from '@elysiajs/jwt'
import { DashboardService } from '../core/services/dashboard.service'
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

export const dashboardController = new Elysia({ prefix: '/dashboard' })
  .use(jwt({
    name: 'jwt',
    secret: process.env.JWT_SECRET || 'super_secret_dev_key',
  }))
  .use(tenantAdminOnly)

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
      const days = parseInt(query.days as string) || 7
      return await DashboardService.getSummary(tenantId, days)
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
      const days = parseInt(query.days as string) || 7
      const interval = (query.interval as 'hour' | 'day') || 'day'
      return await DashboardService.getTimeline(tenantId, days, interval)
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
      const days = parseInt(query.days as string) || 7
      const limit = parseInt(query.limit as string) || 10
      return await DashboardService.getTopHosts(tenantId, days, limit)
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
      const days = parseInt(query.days as string) || 7
      const limit = parseInt(query.limit as string) || 10
      return await DashboardService.getTopUsers(tenantId, days, limit)
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
      const days = parseInt(query.days as string) || 30
      return await DashboardService.getMitreHeatmap(tenantId, days)
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
      const days = parseInt(query.days as string) || 7
      return await DashboardService.getSourcesBreakdown(tenantId, days)
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
      const days = parseInt(query.days as string) || 7
      return await DashboardService.getIntegrationBreakdown(tenantId, days)
    } catch (e: any) {
      set.status = 400
      return { error: e.message }
    }
  })

  // ==================== S1 SITES BREAKDOWN ====================
  .get('/sites', async ({ jwt, cookie: { access_token, selected_tenant }, query, set }) => {
    try {
      const payload = await jwt.verify(access_token.value)
      if (!payload) throw new Error('Unauthorized')

      const tenantId = getEffectiveTenantId(payload, selected_tenant)
      const days = parseInt(query.days as string) || 7
      return await DashboardService.getSiteBreakdown(tenantId, days)
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
