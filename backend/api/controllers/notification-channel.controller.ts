import { Elysia } from 'elysia';
import { jwt } from '@elysiajs/jwt';
import { NotificationChannelService } from '../core/services/notification-channel.service';
import { tenantAdminOnly } from '../middlewares/auth.middleware';

export const notificationChannelController = new Elysia({ prefix: '/notification-channels' })
  .use(jwt({
    name: 'jwt',
    secret: process.env.JWT_SECRET || 'super_secret_dev_key',
  }))
  .use(tenantAdminOnly)

  /**
   * List notification channels (Slack, Teams, webhooks)
   * @route GET /notification-channels
   * @access Protected - Admin only
   * @returns {Object} List of configured notification channels
   */
  .get('/', async ({ user }: any) => {
    const channels = await NotificationChannelService.list(user.tenantId);
    return { success: true, data: channels };
  })

  /**
   * Create notification channel
   * @route POST /notification-channels
   * @access Protected - Admin only
   * @body {string} name - Channel name
   * @body {string} type - Channel type (slack, teams, webhook)
   * @body {string} webhookUrl - Webhook URL
   * @body {string} minSeverity - Minimum severity to notify (optional)
   * @body {array} eventTypes - Event types to notify (optional)
   * @returns {Object} Created channel
   */
  .post('/', async ({ user, body }: any) => {
    const channel = await NotificationChannelService.create(user.tenantId, {
      name: body.name,
      type: body.type,
      webhookUrl: body.webhookUrl,
      minSeverity: body.minSeverity,
      eventTypes: body.eventTypes
    });

    return { success: true, data: channel };
  })

  /**
   * Test webhook connection
   * @route POST /notification-channels/test
   * @access Protected - Admin only
   * @body {string} webhookUrl - Webhook URL to test
   * @body {string} type - Channel type (slack, teams, webhook)
   * @returns {Object} Test result (success/failure)
   */
  .post('/test', async ({ body }: any) => {
    const success = await NotificationChannelService.testWebhook(
      body.webhookUrl,
      body.type
    );

    return { 
      success, 
      message: success ? 'Webhook test successful! Check your channel.' : 'Webhook test failed. Please verify the URL.' 
    };
  })

  /**
   * Update notification channel
   * @route PUT /notification-channels/:id
   * @access Protected - Admin only
   * @param {string} id - Channel ID
   * @body Updated channel configuration
   * @returns {Object} Updated channel
   */
  .put('/:id', async ({ user, params: { id }, body }: any) => {
    const updated = await NotificationChannelService.update(id, user.tenantId, body);
    return { success: true, data: updated };
  })

  /**
   * Delete notification channel
   * @route DELETE /notification-channels/:id
   * @access Protected - Admin only
   * @param {string} id - Channel ID
   * @returns {Object} Success message
   */
  .delete('/:id', async ({ user, params: { id } }: any) => {
    await NotificationChannelService.delete(id, user.tenantId);
    return { success: true, message: 'Channel deleted successfully' };
  });
