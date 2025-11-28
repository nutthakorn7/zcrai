import { Elysia } from 'elysia'
import { jwt } from '@elysiajs/jwt'
import { DashboardService } from '../core/services/dashboard.service'
import { tenantAdminOnly } from '../middlewares/auth.middleware'

export const dashboardController = new Elysia({ prefix: '/dashboard' })
  .use(jwt({
    name: 'jwt',
    secret: process.env.JWT_SECRET || 'super_secret_dev_key',
  }))
  .use(tenantAdminOnly)

  // ==================== SUMMARY ====================
  .get('/summary', async ({ jwt, cookie: { access_token }, query, set }) => {
    try {
      const payload = await jwt.verify(access_token.value)
      if (!payload) throw new Error('Unauthorized')

      const days = parseInt(query.days as string) || 7
      console.log('[Dashboard] getSummary for tenant:', payload.tenantId, 'days:', days)
      const result = await DashboardService.getSummary(payload.tenantId as string, days)
      console.log('[Dashboard] getSummary result:', result)
      return result
    } catch (e: any) {
      console.error('[Dashboard] getSummary error:', e)
      set.status = 400
      return { error: e.message }
    }
  })

  // ==================== TIMELINE ====================
  .get('/timeline', async ({ jwt, cookie: { access_token }, query, set }) => {
    try {
      const payload = await jwt.verify(access_token.value)
      if (!payload) throw new Error('Unauthorized')

      const days = parseInt(query.days as string) || 7
      const interval = (query.interval as 'hour' | 'day') || 'day'
      return await DashboardService.getTimeline(payload.tenantId as string, days, interval)
    } catch (e: any) {
      set.status = 400
      return { error: e.message }
    }
  })

  // ==================== TOP HOSTS ====================
  .get('/top-hosts', async ({ jwt, cookie: { access_token }, query, set }) => {
    try {
      const payload = await jwt.verify(access_token.value)
      if (!payload) throw new Error('Unauthorized')

      const days = parseInt(query.days as string) || 7
      const limit = parseInt(query.limit as string) || 10
      return await DashboardService.getTopHosts(payload.tenantId as string, days, limit)
    } catch (e: any) {
      set.status = 400
      return { error: e.message }
    }
  })

  // ==================== TOP USERS ====================
  .get('/top-users', async ({ jwt, cookie: { access_token }, query, set }) => {
    try {
      const payload = await jwt.verify(access_token.value)
      if (!payload) throw new Error('Unauthorized')

      const days = parseInt(query.days as string) || 7
      const limit = parseInt(query.limit as string) || 10
      return await DashboardService.getTopUsers(payload.tenantId as string, days, limit)
    } catch (e: any) {
      set.status = 400
      return { error: e.message }
    }
  })

  // ==================== MITRE HEATMAP ====================
  .get('/mitre-heatmap', async ({ jwt, cookie: { access_token }, query, set }) => {
    try {
      const payload = await jwt.verify(access_token.value)
      if (!payload) throw new Error('Unauthorized')

      const days = parseInt(query.days as string) || 30
      return await DashboardService.getMitreHeatmap(payload.tenantId as string, days)
    } catch (e: any) {
      set.status = 400
      return { error: e.message }
    }
  })

  // ==================== SOURCES BREAKDOWN ====================
  .get('/sources', async ({ jwt, cookie: { access_token }, query, set }) => {
    try {
      const payload = await jwt.verify(access_token.value)
      if (!payload) throw new Error('Unauthorized')

      const days = parseInt(query.days as string) || 7
      return await DashboardService.getSourcesBreakdown(payload.tenantId as string, days)
    } catch (e: any) {
      set.status = 400
      return { error: e.message }
    }
  })
