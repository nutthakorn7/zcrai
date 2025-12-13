import { Elysia } from 'elysia'
import { jwt } from '@elysiajs/jwt'
import { NotificationService } from '../core/services/notification.service'

export const notificationController = new Elysia({ prefix: '/notifications' })
  .use(
    jwt({
      name: 'jwt',
      secret: process.env.JWT_SECRET || 'super_secret_dev_key',
      exp: '1h'
    })
  )
  
  // Guard: Verify Token
  .derive(async ({ jwt, cookie: { access_token } }) => {
    if (!access_token.value || typeof access_token.value !== 'string') return { user: null }
    const payload = await jwt.verify(access_token.value)
    return { user: payload }
  })
  .onBeforeHandle(({ user, set }) => {
    if (!user) {
      set.status = 401
      return { error: 'Unauthorized' }
    }
  })

  // ==================== LIST NOTIFICATIONS ====================
  .get('/', async ({ user, query }) => {
    // @ts-ignore
    const isRead = query.isRead === 'true' ? true : query.isRead === 'false' ? false : undefined
    // @ts-ignore
    return await NotificationService.list(user.id, { isRead })
  })

  // ==================== GET UNREAD COUNT ====================
  .get('/unread-count', async ({ user }) => {
    // @ts-ignore
    const count = await NotificationService.getUnreadCount(user.id)
    return { count }
  })

  // ==================== MARK AS READ ====================
  .patch('/:id/read', async ({ user, params: { id } }) => {
    // @ts-ignore
    await NotificationService.markAsRead(user.id, id)
    return { success: true }
  })

  // ==================== MARK ALL AS READ ====================
  .patch('/read-all', async ({ user }) => {
    // @ts-ignore
    await NotificationService.markAllAsRead(user.id)
    return { success: true }
  })

  // ==================== GET NOTIFICATION RULES ====================
  .get('/rules', async ({ user }) => {
    // @ts-ignore
    return await NotificationService.getOrCreateRules(user.id)
  })

  // ==================== UPDATE NOTIFICATION RULE ====================
  .patch('/rules/:id', async ({ user, params: { id }, body }) => {
    // @ts-ignore
    await NotificationService.updateRule(user.id, id, body)
    return { success: true }
  })
