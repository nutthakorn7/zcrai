import { Elysia } from 'elysia'
import { withAuth, JWTUserPayload } from '../middleware/auth'
import { NotificationService } from '../core/services/notification.service'

export const notificationController = new Elysia({ prefix: '/notifications' })
  .use(withAuth)

  // ==================== LIST NOTIFICATIONS ====================
  .get('/', async (ctx: any) => {
    const user = ctx.user as JWTUserPayload
    const isRead = ctx.query.isRead === 'true' ? true : ctx.query.isRead === 'false' ? false : undefined
    const notifications = await NotificationService.list(user.userId || user.id || '', { isRead })
    return { success: true, data: notifications }
  })

  // ==================== GET UNREAD COUNT ====================
  .get('/unread-count', async (ctx: any) => {
    const user = ctx.user as JWTUserPayload
    const count = await NotificationService.getUnreadCount(user.userId || user.id || '')
    return { success: true, data: { count } }
  })

  // ==================== MARK AS READ ====================
  .patch('/:id/read', async (ctx: any) => {
    const user = ctx.user as JWTUserPayload
    const notification = await NotificationService.markAsRead(user.userId || user.id || '', ctx.params.id)
    return { success: true, data: notification }
  })

  // ==================== MARK ALL AS READ ====================
  .patch('/mark-all-read', async (ctx: any) => {
    const user = ctx.user as JWTUserPayload
    const result = await NotificationService.markAllAsRead(user.userId || user.id || '')
    return { success: true, data: result }
  })

  // ==================== GET NOTIFICATION RULES ====================
  .get('/rules', async (ctx: any) => {
    const user = ctx.user as JWTUserPayload
    const rules = await NotificationService.getOrCreateRules(user.userId || user.id || '')
    return { success: true, data: rules }
  })

  // ==================== UPDATE NOTIFICATION RULE ====================
  .patch('/rules/:id', async (ctx: any) => {
    const user = ctx.user as JWTUserPayload
    await NotificationService.updateRule(user.userId || user.id || '', ctx.params.id, ctx.body)
    return { success: true }
  })
