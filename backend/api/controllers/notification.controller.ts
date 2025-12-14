import { Elysia } from 'elysia'
import { withAuth } from '../middleware/auth'
import { NotificationService } from '../core/services/notification.service'

export const notificationController = new Elysia({ prefix: '/notifications' })
  .use(withAuth)

  // ==================== LIST NOTIFICATIONS ====================
  .get('/', async ({ user, query }: any) => {
    const isRead = query.isRead === 'true' ? true : query.isRead === 'false' ? false : undefined
    const notifications = await NotificationService.list(user.id, { isRead })
    return { success: true, data: notifications }
  })

  // ==================== GET UNREAD COUNT ====================
  .get('/unread-count', async ({ user }: any) => {
    const count = await NotificationService.getUnreadCount(user.id)
    return { success: true, data: { count } }
  })

  // ==================== MARK AS READ ====================
  .patch('/:id/read', async ({ user, params: { id } }: any) => {
    const notification = await NotificationService.markAsRead(user.id, id)
    return { success: true, data: notification }
  })

  // ==================== MARK ALL AS READ ====================
  .patch('/mark-all-read', async ({ user }: any) => {
    const result = await NotificationService.markAllAsRead(user.id)
    return { success: true, data: result }
  })

  // ==================== GET NOTIFICATION RULES ====================
  .get('/rules', async ({ user }: any) => {
    const rules = await NotificationService.getOrCreateRules(user.id)
    return { success: true, data: rules }
  })

  // ==================== UPDATE NOTIFICATION RULE ====================
  .patch('/rules/:id', async ({ user, params: { id }, body }) => {
    // @ts-ignore
    await NotificationService.updateRule(user.id, id, body)
    return { success: true }
  })
