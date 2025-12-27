import { db } from '../../infra/db'
import { notifications, notificationRules, users } from '../../infra/db/schema'
import { eq, and, desc } from 'drizzle-orm'
import { EmailService } from './email.service'
import { NotificationChannelService } from './notification-channel.service'

export const NotificationService = {
  // Create and dispatch notification
  async create(data: {
    tenantId: string;
    userId: string;
    type: string;
    title: string;
    message: string;
    metadata?: any;
  }) {
    // 1. Create in-app notification
    const [notification] = await db.insert(notifications).values({
      tenantId: data.tenantId,
      userId: data.userId,
      type: data.type,
      title: data.title,
      message: data.message,
      metadata: data.metadata,
      isRead: false
    }).returning()

    // 2. Broadcast via WebSocket (Real-time Toast)
    // Import dynamically to avoid circular dependency issues if any, or standard import if safe.
    // Assuming standard import is fine or using the global one.
    const { SocketService } = await import('./socket.service');
    SocketService.broadcast(`user:${data.userId}`, 'new_notification', notification);

    // 3. Check user's notification rules
    const rules = await db.select()
      .from(notificationRules)
      .where(and(
        eq(notificationRules.userId, data.userId),
        eq(notificationRules.eventType, data.type),
        eq(notificationRules.enabled, true)
      ))

    // 4. Send via configured channels
    for (const rule of rules) {
      if (rule.channel === 'email') {
        await this.sendEmail(data.userId, data.title, data.message, data.metadata)
      }
    }

    // 5. Send to external channels (Slack, Teams, etc.)
    try {
      await NotificationChannelService.send(data.tenantId, {
        type: data.type as any,
        severity: data.metadata?.severity,
        title: data.title,
        message: data.message,
        metadata: data.metadata
      });
    } catch (error) {
      console.error('Failed to send external notifications:', error);
      // Don't fail the whole notification if external send fails
    }

    return notification
  },

  // Send email notification
  async sendEmail(userId: string, title: string, message: string, metadata?: any) {
    const [user] = await db.select().from(users).where(eq(users.id, userId))
    if (!user) return

    const caseLink = metadata?.caseId 
      ? `${process.env.FRONTEND_URL || 'https://app.zcr.ai'}/cases/${metadata.caseId}`
      : null

    const html = `
      <h2>${title}</h2>
      <p>${message}</p>
      ${caseLink ? `<p><a href="${caseLink}">View Case</a></p>` : ''}
    `

    try {
      await EmailService.sendEmail({
        to: user.email,
        subject: `[zcrAI] ${title}`,
        html
      })
    } catch (e) {
      console.error('Failed to send email notification:', e)
    }
  },

  // List user's notifications
  async list(userId: string, filters?: { isRead?: boolean }) {
    const conditions = [eq(notifications.userId, userId)]
    
    if (filters?.isRead !== undefined) {
      conditions.push(eq(notifications.isRead, filters.isRead))
    }

    return await db.select()
      .from(notifications)
      .where(and(...conditions))
      .orderBy(desc(notifications.createdAt))
      .limit(50)
  },

  // Mark as read
  async markAsRead(userId: string, notificationId: string) {
    await db.update(notifications)
      .set({ isRead: true })
      .where(and(
        eq(notifications.id, notificationId),
        eq(notifications.userId, userId)
      ))
  },

  // Mark all as read
  async markAllAsRead(userId: string) {
    await db.update(notifications)
      .set({ isRead: true })
      .where(and(
        eq(notifications.userId, userId),
        eq(notifications.isRead, false)
      ))
  },

  // Get unread count
  async getUnreadCount(userId: string): Promise<number> {
    const result = await db.select()
      .from(notifications)
      .where(and(
        eq(notifications.userId, userId),
        eq(notifications.isRead, false)
      ))
    
    return result.length
  },

  // Get or create default notification rules for user
  async getOrCreateRules(userId: string) {
    const existing = await db.select()
      .from(notificationRules)
      .where(eq(notificationRules.userId, userId))

    if (existing.length > 0) return existing

    // Create default rules
    const defaults = [
      { userId, channel: 'in-app', eventType: 'case_assigned', enabled: true },
      { userId, channel: 'in-app', eventType: 'case_commented', enabled: true },
      { userId, channel: 'in-app', eventType: 'case_status_changed', enabled: true },
      { userId, channel: 'email', eventType: 'case_assigned', enabled: true },
      { userId, channel: 'email', eventType: 'threat_critical', enabled: true, minSeverity: 'critical' },
    ]

    return await db.insert(notificationRules).values(defaults).returning()
  },

  // Update notification rule
  async updateRule(userId: string, ruleId: string, data: { enabled?: boolean; minSeverity?: string }) {
    await db.update(notificationRules)
      .set(data)
      .where(and(
        eq(notificationRules.id, ruleId),
        eq(notificationRules.userId, userId)
      ))
  }
}
