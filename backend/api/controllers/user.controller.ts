import { Elysia, t } from 'elysia'
import { withAuth } from '../middleware/auth'
import { UserService } from '../core/services/user.service'
import { AuditService } from '../core/services/audit.service'
import { Errors } from '../middleware/error'
import { HTTP_STATUS } from '../config/constants'
import { InviteUserSchema, UpdateUserSchema } from '../validators/user.validator'

export const userController = new Elysia({ prefix: '/users' })
  .use(withAuth)
  
  /**
   * List all users in the authenticated user's tenant
   * @route GET /users
   * @access Protected - Requires authentication
   * @returns {Object} List of users in the tenant
   */
  .get('/', async ({ user }: any) => {
    const users = await UserService.list(user.tenantId)
    return { success: true, data: users }
  }, {
    detail: {
        tags: ['Users'],
        summary: 'List Users',
        description: 'Get all users in the current tenant.'
    }
  })

  /**
   * Invite a new user to the tenant
   * @route POST /users
   * @access Protected - Admin/SuperAdmin only for certain roles
   * @body {string} email - User email address
   * @body {string} role - User role (user, admin, superadmin)
   * @body {string} name - User display name
   * @returns {Object} Invited user details
   * @throws {403} Forbidden if trying to create superadmin without permission
   * @throws {400} User limit reached (billing check)
   */
  .post('/', async ({ body, user, set }: any) => {
    // Role validation
    if (body.role === 'superadmin' && user.role !== 'superadmin') {
      throw Errors.Forbidden('Only Super Admin can create another Super Admin')
    }

    // Check billing limits
    const { BillingService } = await import('../core/services/billing.service')
    const limitCheck = await BillingService.checkLimit(user.tenantId, 'users')
    if (!limitCheck.allowed) {
      throw Errors.UpgradeRequired(`User limit reached (${limitCheck.current}/${limitCheck.max})`)
    }

    const result = await UserService.invite(user.tenantId, body)
    set.status = HTTP_STATUS.CREATED
    return { message: 'User invited successfully', user: result.user }
  }, { 
    body: InviteUserSchema,
    detail: {
        tags: ['Users'],
        summary: 'Invite User',
        description: 'Invite a new user to the tenant.'
    }
  })

  /**
   * Get detailed information about a specific user
   * @route GET /users/:id
   * @access Protected - Requires authentication
   * @param {string} id - User ID
   * @returns {Object} User details
   */
  .get('/:id', async ({ user, params: { id } }: any) => {
    const targetUser = await UserService.getById(user.tenantId, id)
    return { success: true, data: targetUser }
  }, {
    params: t.Object({ id: t.String() }),
    detail: {
        tags: ['Users'],
        summary: 'Get User Details'
    }
  })

  /**
   * Update user details and permissions
   * @route PUT /users/:id
   * @access Protected - Admin/SuperAdmin only
   * @param {string} id - User ID
   * @body {string} name - Updated name (optional)
   * @body {string} role - Updated role (optional)
   * @body {boolean} isActive - Account status (optional)
   * @returns {Object} Updated user data
   */
  .put('/:id', async ({ user, params: { id }, body }: any) => {
    const updated = await UserService.update(user.tenantId, id, body)

    // Audit Log for Role Change
    if (body.role) {
      await AuditService.log({
        tenantId: user.tenantId,
        userId: user.id,
        action: 'UPDATE_USER_ROLE',
        resource: 'user',
        resourceId: id,
        details: { newRole: body.role },
        status: 'SUCCESS'
      })
    }

    return { success: true, data: updated }
  }, { 
    body: UpdateUserSchema,
    params: t.Object({ id: t.String() }),
    detail: {
        tags: ['Users'],
        summary: 'Update User'
    }
  })

  /**
   * Delete/deactivate a user account
   * @route DELETE /users/:id
   * @access Protected - Admin/SuperAdmin only
   * @param {string} id - User ID
   * @returns {Object} Success message
   */
  .delete('/:id', async ({ user, params: { id } }: any) => {
    await UserService.delete(user.tenantId, id)
    return { success: true, message: 'User deleted successfully' }
  })
