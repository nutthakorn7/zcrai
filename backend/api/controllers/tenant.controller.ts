import { Elysia, t } from 'elysia'
import { TenantService } from '../core/services/tenant.service'
import { superAdminOnly } from '../middlewares/auth.middleware'
import { CreateTenantSchema, UpdateTenantSchema, TenantQuerySchema } from '../validators/tenant.validator'

export const tenantController = new Elysia({ prefix: '/tenants' })
  .use(superAdminOnly)

  // ==================== LIST TENANTS ====================
  .get('/', async ({ query, set }) => {
    try {
      const { search, status, page, limit } = query
      return await TenantService.list({
        search,
        status,
        page: page ? parseInt(page) : 1,
        limit: limit ? parseInt(limit) : 20,
      })
    } catch (e: any) {
      set.status = 400
      return { error: e.message }
    }
  }, { query: TenantQuerySchema })

  // ==================== GET TENANT BY ID ====================
  .get('/:id', async ({ params, set }) => {
    try {
      return await TenantService.getStats(params.id)
    } catch (e: any) {
      set.status = 404
      return { error: e.message }
    }
  })

  // ==================== CREATE TENANT ====================
  .post('/', async ({ body, set }) => {
    try {
      const tenant = await TenantService.create(body)
      set.status = 201
      return { message: 'Tenant created successfully', tenant }
    } catch (e: any) {
      set.status = 400
      return { error: e.message }
    }
  }, { body: CreateTenantSchema })

  // ==================== UPDATE TENANT ====================
  .put('/:id', async ({ params, body, set }) => {
    try {
      const tenant = await TenantService.update(params.id, body)
      return { message: 'Tenant updated successfully', tenant }
    } catch (e: any) {
      set.status = 400
      return { error: e.message }
    }
  }, { body: UpdateTenantSchema })

  // ==================== DELETE TENANT (Soft Delete) ====================
  .delete('/:id', async ({ params, set }) => {
    try {
      await TenantService.delete(params.id)
      return { message: 'Tenant suspended successfully' }
    } catch (e: any) {
      set.status = 400
      return { error: e.message }
    }
  })
