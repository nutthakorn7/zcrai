import axios from 'axios';
import { db } from '../../infra/db';
import { notificationChannels } from '../../infra/db/schema';
import { eq, and } from 'drizzle-orm';

export class NotificationChannelService {
  /**
   * Send notification to all configured channels
   */
  static async send(tenantId: string, notification: {
    type: 'alert' | 'case_assigned' | 'case_status_changed' | 'system';
    severity?: string;
    title: string;
    message: string;
    metadata?: any;
  }) {
    // Get enabled channels for this tenant
    const channels = await db
      .select()
      .from(notificationChannels)
      .where(and(
        eq(notificationChannels.tenantId, tenantId),
        eq(notificationChannels.enabled, true)
      ));

    // Send to each channel that matches filters
    const results = await Promise.allSettled(
      channels
        .filter(ch => this.shouldSend(ch, notification))
        .map(ch => this.sendToChannel(ch, notification))
    );

    return {
      sent: results.filter(r => r.status === 'fulfilled').length,
      failed: results.filter(r => r.status === 'rejected').length
    };
  }

  /**
   * Check if notification should be sent to channel
   */
  private static shouldSend(channel: any, notification: any): boolean {
    // Check event type filter
    const eventTypes = (channel.eventTypes as string[]) || [];
    if (eventTypes.length > 0 && !eventTypes.includes(notification.type)) {
      return false;
    }

    // Check severity filter
    if (channel.minSeverity && notification.severity) {
      const severities = ['info', 'low', 'medium', 'high', 'critical'];
      const minIndex = severities.indexOf(channel.minSeverity);
      const notifIndex = severities.indexOf(notification.severity);
      if (notifIndex < minIndex) return false;
    }

    return true;
  }

  /**
   * Send to specific channel
   */
  private static async sendToChannel(channel: any, notification: any) {
    const payload = channel.type === 'slack'
      ? this.formatSlackMessage(notification)
      : channel.type === 'teams'
      ? this.formatTeamsMessage(notification)
      : this.formatGenericWebhook(notification);

    await axios.post(channel.webhookUrl, payload, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 5000
    });
  }

  /**
   * Format message for Slack
   */
  private static formatSlackMessage(notification: any) {
    const color = this.getSeverityColor(notification.severity);
    const emoji = this.getSeverityEmoji(notification.severity);
    
    return {
      text: `${emoji} ${notification.title}`,
      attachments: [{
        color,
        title: notification.title,
        text: notification.message,
        fields: [
          {
            title: 'Severity',
            value: notification.severity?.toUpperCase() || 'N/A',
            short: true
          },
          {
            title: 'Type',
            value: notification.type.replace(/_/g, ' ').toUpperCase(),
            short: true
          }
        ],
        footer: 'zcrAI Security Operations',
        footer_icon: 'https://zcr.ai/favicon.ico',
        ts: Math.floor(Date.now() / 1000)
      }]
    };
  }

  /**
   * Format message for Microsoft Teams
   */
  private static formatTeamsMessage(notification: any) {
    const color = this.getSeverityColor(notification.severity);
    const emoji = this.getSeverityEmoji(notification.severity);
    
    return {
      '@type': 'MessageCard',
      '@context': 'https://schema.org/extensions',
      summary: notification.title,
      themeColor: color.replace('#', ''),
      title: `${emoji} ${notification.title}`,
      text: notification.message,
      sections: [{
        facts: [
          { name: 'Severity', value: notification.severity?.toUpperCase() || 'N/A' },
          { name: 'Type', value: notification.type.replace(/_/g, ' ').toUpperCase() },
          { name: 'Time', value: new Date().toLocaleString() }
        ]
      }],
      potentialAction: notification.metadata?.caseId ? [{
        '@type': 'OpenUri',
        name: 'View Case',
        targets: [{
          os: 'default',
          uri: `${process.env.FRONTEND_URL || 'https://app.zcr.ai'}/cases/${notification.metadata.caseId}`
        }]
      }] : undefined
    };
  }

  /**
   * Format generic webhook payload
   */
  private static formatGenericWebhook(notification: any) {
    return {
      title: notification.title,
      message: notification.message,
      severity: notification.severity,
      type: notification.type,
      metadata: notification.metadata,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Get color for severity
   */
  private static getSeverityColor(severity?: string): string {
    const colors: Record<string, string> = {
      critical: '#e74c3c',
      high: '#e67e22',
      medium: '#f39c12',
      low: '#3498db',
      info: '#95a5a6'
    };
    return colors[severity || 'info'] || '#95a5a6';
  }

  /**
   * Get emoji for severity
   */
  private static getSeverityEmoji(severity?: string): string {
    const emojis: Record<string, string> = {
      critical: '🚨',
      high: '⚠️',
      medium: '⚡',
      low: 'ℹ️',
      info: '📢'
    };
    return emojis[severity || 'info'] || '📢';
  }

  /**
   * Test webhook connection
   */
  static async testWebhook(webhookUrl: string, type: 'slack' | 'teams' | 'webhook'): Promise<boolean> {
    try {
      const testMessage = {
        title: '🔔 Test Notification',
        message: 'This is a test notification from zcrAI. Connection successful!',
        type: 'system' as const,
        severity: 'info'
      };

      const payload = type === 'slack'
        ? this.formatSlackMessage(testMessage)
        : type === 'teams'
        ? this.formatTeamsMessage(testMessage)
        : this.formatGenericWebhook(testMessage);

      await axios.post(webhookUrl, payload, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 5000
      });

      return true;
    } catch (error) {
      console.error('Webhook test failed:', error);
      return false;
    }
  }

  /**
   * Create notification channel
   */
  static async create(tenantId: string, data: {
    name: string;
    type: 'slack' | 'teams' | 'webhook';
    webhookUrl: string;
    minSeverity?: string;
    eventTypes?: string[];
  }) {
    const [channel] = await db
      .insert(notificationChannels)
      .values({
        tenantId,
        ...data,
        enabled: true,
      })
      .returning();

    return channel;
  }

  /**
   * List channels for tenant
   */
  static async list(tenantId: string) {
    return await db
      .select()
      .from(notificationChannels)
      .where(eq(notificationChannels.tenantId, tenantId));
  }

  /**
   * Update channel
   */
  static async update(channelId: string, tenantId: string, data: any) {
    const [updated] = await db
      .update(notificationChannels)
      .set({
        ...data,
        updatedAt: new Date()
      })
      .where(and(
        eq(notificationChannels.id, channelId),
        eq(notificationChannels.tenantId, tenantId)
      ))
      .returning();

    return updated;
  }

  /**
   * Delete channel
   */
  static async delete(channelId: string, tenantId: string) {
    await db
      .delete(notificationChannels)
      .where(and(
        eq(notificationChannels.id, channelId),
        eq(notificationChannels.tenantId, tenantId)
      ));
  }
}
