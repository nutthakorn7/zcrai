import { Elysia } from 'elysia'
import { jwt } from '@elysiajs/jwt'
import { UserService } from '../core/services/user.service'
import { tenantAdminOnly } from '../middlewares/auth.middleware'
import { InviteUserSchema, UpdateUserSchema, UserQuerySchema } from '../validators/user.validator'

export const userController = new Elysia({ prefix: '/users' })
  .use(jwt({
    name: 'jwt',
    secret: process.env.JWT_SECRET || 'super_secret_dev_key',
  }))
  .use(tenantAdminOnly)

  // ==================== LIST USERS (ภายใน Tenant) ====================
  .get('/', async ({ query, jwt, cookie: { access_token }, set }) => {
    try {
      const payload = await jwt.verify(access_token.value as string)
      if (!payload) throw new Error('Unauthorized')

      const { search, role, status, page, limit } = query
      return await UserService.list(payload.tenantId as string, {
        search,
        role,
        status,
        page: page ? parseInt(page) : 1,
        limit: limit ? parseInt(limit) : 20,
      })
    } catch (e: any) {
      set.status = 400
      return { error: e.message }
    }
  }, { query: UserQuerySchema })

  // ==================== GET USER BY ID ====================
  .get('/:id', async ({ params, jwt, cookie: { access_token }, set }) => {
    try {
      const payload = await jwt.verify(access_token.value as string)
      if (!payload) throw new Error('Unauthorized')

      return await UserService.getById(params.id, payload.tenantId as string)
    } catch (e: any) {
      set.status = 404
      return { error: e.message }
    }
  })

  // ==================== INVITE USER ====================
  .post('/', async ({ body, jwt, cookie: { access_token }, set }) => {
    try {
      const payload = await jwt.verify(access_token.value as string)
      if (!payload) throw new Error('Unauthorized')

      // Role validation
      if (body.role === 'superadmin' && payload.role !== 'superadmin') {
        throw new Error('Forbidden: Only Super Admin can create another Super Admin')
      }

      // Check Billing Limits
      const { BillingService } = await import('../core/services/billing.service')
      const limitCheck = await BillingService.checkLimit(payload.tenantId as string, 'users')
      if (!limitCheck.allowed) {
        throw new Error(`Upgrade Required: User limit reached (${limitCheck.current}/${limitCheck.max})`)
      }

      const result = await UserService.invite(payload.tenantId as string, body)
      set.status = 201
      return { message: 'User invited successfully', user: result.user }
    } catch (e: any) {
      set.status = e.message.startsWith('Forbidden') ? 403 : 400
      return { error: e.message }
    }
  }, { body: InviteUserSchema })

  // ==================== UPDATE USER ====================
  .put('/:id', async ({ params, body, jwt, cookie: { access_token }, set }) => {
    try {
      const payload = await jwt.verify(access_token.value as string)
      if (!payload) throw new Error('Unauthorized')

      // Role validation
      if (body.role === 'superadmin' && payload.role !== 'superadmin') {
        throw new Error('Forbidden: Only Super Admin can assign Super Admin role')
      }

      const user = await UserService.update(params.id, payload.tenantId as string, body)
      return { message: 'User updated successfully', user }
    } catch (e: any) {
      set.status = e.message.startsWith('Forbidden') ? 403 : 400
      return { error: e.message }
    }
  }, { body: UpdateUserSchema })

  // ==================== DELETE USER (Soft Delete) ====================
  .delete('/:id', async ({ params, jwt, cookie: { access_token }, set }) => {
    try {
      const payload = await jwt.verify(access_token.value as string)
      if (!payload) throw new Error('Unauthorized')

      await UserService.delete(params.id, payload.tenantId as string)
      return { message: 'User suspended successfully' }
    } catch (e: any) {
      set.status = 400
      return { error: e.message }
    }
  })
