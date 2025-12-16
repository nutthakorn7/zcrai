import { Elysia } from 'elysia'
import { TenantService } from '../core/services/tenant.service'
import { superAdminOnly } from '../middlewares/auth.middleware'
import { HTTP_STATUS } from '../config/constants'
import { CreateTenantSchema, UpdateTenantSchema, TenantQuerySchema } from '../validators/tenant.validator'

export const tenantController = new Elysia({ prefix: '/tenants' })
  .use(superAdminOnly)

  // ==================== LIST TENANTS ====================
  .get('/', async ({ query }: any) => {
    const { search, status, page, limit } = query
    return await TenantService.list({
      search,
      status,
      page: page ? parseInt(page) : 1,
      limit: limit ? parseInt(limit) : 20,
    })
  }, { query: TenantQuerySchema })

  // ==================== GET TENANT BY ID ====================
  .get('/:id', async ({ params }: any) => {
    return await TenantService.getStats(params.id)
  })

  // ==================== CREATE TENANT ====================
  .post('/', async ({ body, set }: any) => {
    const tenant = await TenantService.create(body)
    set.status = HTTP_STATUS.CREATED
    return { message: 'Tenant created successfully', tenant }
  }, { body: CreateTenantSchema })

  // ==================== UPDATE TENANT ====================
  .put('/:id', async ({ params, body }: any) => {
    const tenant = await TenantService.update(params.id, body)
    return { message: 'Tenant updated successfully', tenant }
  }, { body: UpdateTenantSchema })

  // ==================== DELETE TENANT (Soft Delete) ====================
  .delete('/:id', async ({ params }: any) => {
    await TenantService.delete(params.id)
    return { message: 'Tenant suspended successfully' }
  })
