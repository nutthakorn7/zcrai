import { Elysia } from 'elysia'
import { TenantService } from '../core/services/tenant.service'
import { AuditService } from '../core/services/audit.service'
import { superAdminOnly } from '../middlewares/auth.middleware'
import { HTTP_STATUS } from '../config/constants'
import { CreateTenantSchema, UpdateTenantSchema, TenantQuerySchema } from '../validators/tenant.validator'

export const tenantController = new Elysia({ prefix: '/tenants' })
  .use(superAdminOnly)

  /**
   * List all tenants in the system
   * @route GET /tenants
   * @access SuperAdmin only
   * @query {string} search - Search by name (optional)
   * @query {string} status - Filter by status (optional)
   * @query {number} page - Page number (default: 1)
   * @query {number} limit - Results per page (default: 20)
   * @returns {Object} Paginated list of tenants
   */
  .get('/', async ({ query }: any) => {
    const { search, status, page, limit } = query
    return await TenantService.list({
      search,
      status,
      page: page ? parseInt(page) : 1,
      limit: limit ? parseInt(limit) : 20,
    })
  }, { 
    query: TenantQuerySchema,
    detail: {
        tags: ['Tenants'],
        summary: 'List Tenants',
        description: 'Get all tenants (Super Admin only).'
    }
  })

  /**
   * Get tenant details and statistics
   * @route GET /tenants/:id
   * @access SuperAdmin only
   * @param {string} id - Tenant ID
   * @returns {Object} Tenant info with usage stats
   */
  .get('/:id', async ({ params }: any) => {
    return await TenantService.getStats(params.id)
  }, {
      detail: {
          tags: ['Tenants'],
          summary: 'Get Tenant Details'
      }
  })

  /**
   * Create a new tenant organization
   * @route POST /tenants
   * @access SuperAdmin only
   * @body {string} name - Organization name
   * @body {string} domain - Domain identifier
   * @returns {Object} Created tenant
   */
  .post('/', async ({ body, set }: any) => {
    const tenant = await TenantService.create(body)
    set.status = HTTP_STATUS.CREATED
    return { message: 'Tenant created successfully', tenant }
  }, { 
    body: CreateTenantSchema,
    detail: {
        tags: ['Tenants'],
        summary: 'Create Tenant',
        description: 'Create a new tenant organization.'
    }
  })

  /**
   * Update tenant information
   * @route PUT /tenants/:id
   * @access SuperAdmin only
   * @param {string} id - Tenant ID
   * @body {string} name - Updated name (optional)
   * @body {string} status - Updated status (optional)
   * @returns {Object} Updated tenant
   */
  .put('/:id', async ({ params, body, user }: any) => {
    const tenant = await TenantService.update(params.id, body)

    // Audit Log for Tensor/Quota Update
    if (body.maxUsers || body.maxEvents || body.maxStorage) {
         await AuditService.log({
            tenantId: user?.tenantId,
            userId: user?.id,
            action: 'UPDATE_TENANT_QUOTA',
            resource: 'tenant',
            resourceId: params.id,
            details: { 
                maxUsers: body.maxUsers,
                maxEvents: body.maxEvents,
                maxStorage: body.maxStorage 
            },
            status: 'SUCCESS'
         })
    }
    return { message: 'Tenant updated successfully', tenant }
  }, { 
    body: UpdateTenantSchema,
    detail: {
        tags: ['Tenants'],
        summary: 'Update Tenant',
        description: 'Update tenant details or quotas.'
    }
  })

  /**
   * Suspend/delete a tenant
   * @route DELETE /tenants/:id
   * @access SuperAdmin only
   * @param {string} id - Tenant ID
   * @returns {Object} Success message
   */
  .delete('/:id', async ({ params }: any) => {
    await TenantService.delete(params.id)
    return { message: 'Tenant suspended successfully' }
  }, {
      detail: {
          tags: ['Tenants'],
          summary: 'Delete Tenant'
      }
  })
