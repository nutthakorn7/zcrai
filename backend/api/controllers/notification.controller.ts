import { Elysia } from 'elysia'
import { withAuth, JWTUserPayload } from '../middleware/auth'
import { NotificationService } from '../core/services/notification.service'

export const notificationController = new Elysia({ prefix: '/notifications' })
  .use(withAuth)

  /**
   * List user notifications
   * @route GET /notifications
   * @access Protected - Requires authentication
   * @query {boolean} isRead - Filter by read status (optional)
   * @returns {Object} List of user notifications
   */
  .get('/', async (ctx: any) => {
    const user = ctx.user as JWTUserPayload
    const isRead = ctx.query.isRead === 'true' ? true : ctx.query.isRead === 'false' ? false : undefined
    const notifications = await NotificationService.list(user.id || '', { isRead })
    return { success: true, data: notifications }
  })

  /**
   * Get count of unread notifications
   * @route GET /notifications/unread-count
   * @access Protected - Requires authentication
   * @returns {Object} Unread notification count
   */
  .get('/unread-count', async (ctx: any) => {
    const user = ctx.user as JWTUserPayload
    const count = await NotificationService.getUnreadCount(user.id || '')
    return { success: true, data: { count } }
  })

  /**
   * Mark notification as read
   * @route PATCH /notifications/:id/read
   * @access Protected - Requires authentication
   * @param {string} id - Notification ID
   * @returns {Object} Updated notification
   */
  .patch('/:id/read', async (ctx: any) => {
    const user = ctx.user as JWTUserPayload
    const notification = await NotificationService.markAsRead(user.id || '', ctx.params.id)
    return { success: true, data: notification }
  })

  /**
   * Mark all notifications as read
   * @route PATCH /notifications/mark-all-read
   * @access Protected - Requires authentication
   * @returns {Object} Success status
   */
  .patch('/mark-all-read', async (ctx: any) => {
    const user = ctx.user as JWTUserPayload
    const result = await NotificationService.markAllAsRead(user.id || '')
    return { success: true, data: result }
  })

  /**
   * Get user notification preferences/rules
   * @route GET /notifications/rules
   * @access Protected - Requires authentication
   * @returns {Object} Notification rules (email, in-app preferences)
   */
  .get('/rules', async (ctx: any) => {
    const user = ctx.user as JWTUserPayload
    const rules = await NotificationService.getOrCreateRules(user.id || '')
    return { success: true, data: rules }
  })

  /**
   * Update notification rule preferences
   * @route PATCH /notifications/rules/:id
   * @access Protected - Requires authentication
   * @param {string} id - Rule ID
   * @body Updated rule configuration
   * @returns {Object} Success status
   */
  .patch('/rules/:id', async (ctx: any) => {
    const user = ctx.user as JWTUserPayload
    await NotificationService.updateRule(user.id || '', ctx.params.id, ctx.body)
    return { success: true }
  })
