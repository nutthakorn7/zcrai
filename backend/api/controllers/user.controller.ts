import { Elysia } from 'elysia'
import { UserService } from '../core/services/user.service'
import { tenantAdminOnly } from '../middlewares/auth.middleware'
import { Errors } from '../middleware/error'
import { HTTP_STATUS } from '../config/constants'
import { InviteUserSchema, UpdateUserSchema, UserQuerySchema } from '../validators/user.validator'

export const userController = new Elysia({ prefix: '/users' })
  .use(tenantAdminOnly)

  // ==================== LIST USERS (ภายใน Tenant) ====================
  .get('/', async ({ query, user }: any) => {
    const { search, role, status, page, limit } = query
    return await UserService.list(user.tenantId, {
      search,
      role,
      status,
      page: page ? parseInt(page) : 1,
      limit: limit ? parseInt(limit) : 20,
    })
  }, { query: UserQuerySchema })

  // ==================== GET USER BY ID ====================
  .get('/:id', async ({ params, user }: any) => {
    return await UserService.getById(params.id, user.tenantId)
  })

  // ==================== INVITE USER ====================
  .post('/', async ({ body, user, set }: any) => {
    // Role validation
    if (body.role === 'superadmin' && user.role !== 'superadmin') {
      throw Errors.Forbidden('Only Super Admin can create another Super Admin')
    }

    // Check Billing Limits
    const { BillingService } = await import('../core/services/billing.service')
    const limitCheck = await BillingService.checkLimit(user.tenantId, 'users')
    if (!limitCheck.allowed) {
      throw Errors.UpgradeRequired(`User limit reached (${limitCheck.current}/${limitCheck.max})`)
    }

    const result = await UserService.invite(user.tenantId, body)
    set.status = HTTP_STATUS.CREATED
    return { message: 'User invited successfully', user: result.user }
  }, { body: InviteUserSchema })

  // ==================== UPDATE USER ====================
  .put('/:id', async ({ params, body, user }: any) => {
    // Role validation
    if (body.role === 'superadmin' && user.role !== 'superadmin') {
      throw Errors.Forbidden('Only Super Admin can assign Super Admin role')
    }

    const updatedUser = await UserService.update(params.id, user.tenantId, body)
    return { message: 'User updated successfully', user: updatedUser }
  }, { body: UpdateUserSchema })

  // ==================== DELETE USER (Soft Delete) ====================
  .delete('/:id', async ({ params, user }: any) => {
    await UserService.delete(params.id, user.tenantId)
    return { message: 'User suspended successfully' }
  })
