import { Elysia } from 'elysia'
import { jwt } from '@elysiajs/jwt'
import { LogsService } from '../core/services/logs.service'
import { tenantAdminOnly } from '../middlewares/auth.middleware'

export const logsController = new Elysia({ prefix: '/logs' })
  .use(jwt({
    name: 'jwt',
    secret: process.env.JWT_SECRET || 'super_secret_dev_key',
  }))
  .use(tenantAdminOnly)

  // ==================== GET FILTER OPTIONS (ต้องอยู่ก่อน /:id) ====================
  .get('/filters', async ({ jwt, cookie: { access_token }, set }) => {
    try {
      const payload = await jwt.verify(access_token.value)
      if (!payload) throw new Error('Unauthorized')

      return await LogsService.getFilterOptions(payload.tenantId as string)
    } catch (e: any) {
      set.status = 400
      return { error: e.message }
    }
  })

  // ==================== LIST LOGS ====================
  .get('/', async ({ jwt, cookie: { access_token }, query, set }) => {
    try {
      const payload = await jwt.verify(access_token.value)
      if (!payload) throw new Error('Unauthorized')

      // Parse query params - รวม filters ใหม่สำหรับ Integration และ S1 Tenant
      const filters = {
        startDate: query.startDate as string | undefined,
        endDate: query.endDate as string | undefined,
        severity: query.severity ? (query.severity as string).split(',') : undefined,
        source: query.source ? (query.source as string).split(',') : undefined,
        host: query.host as string | undefined,
        user: query.user as string | undefined,
        search: query.search as string | undefined,
        eventType: query.eventType as string | undefined,
        // New filters
        integrationId: query.integration_id as string | undefined,
        accountName: query.account_name as string | undefined,
        siteName: query.site_name as string | undefined,
      }

      const pagination = {
        page: parseInt(query.page as string) || 1,
        limit: Math.min(parseInt(query.limit as string) || 50, 100), // Max 100
        sortBy: (query.sortBy as string) || 'timestamp',
        sortOrder: ((query.sortOrder as string) || 'desc') as 'asc' | 'desc',
      }

      return await LogsService.list(payload.tenantId as string, filters, pagination)
    } catch (e: any) {
      set.status = 400
      return { error: e.message }
    }
  })

  // ==================== GET SINGLE LOG ====================
  .get('/:id', async ({ jwt, cookie: { access_token }, params, set }) => {
    try {
      const payload = await jwt.verify(access_token.value)
      if (!payload) throw new Error('Unauthorized')

      const log = await LogsService.getById(payload.tenantId as string, params.id)
      if (!log) {
        set.status = 404
        return { error: 'Log not found' }
      }
      return log
    } catch (e: any) {
      set.status = 400
      return { error: e.message }
    }
  })
