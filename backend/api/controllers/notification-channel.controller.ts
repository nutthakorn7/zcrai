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

  // ==================== LIST CHANNELS ====================
  .get('/', async ({ user }: any) => {
    const channels = await NotificationChannelService.list(user.tenantId);
    return { success: true, data: channels };
  })

  // ==================== CREATE CHANNEL ====================
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

  // ==================== TEST WEBHOOK ====================
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

  // ==================== UPDATE CHANNEL ====================
  .put('/:id', async ({ user, params: { id }, body }: any) => {
    const updated = await NotificationChannelService.update(id, user.tenantId, body);
    return { success: true, data: updated };
  })

  // ==================== DELETE CHANNEL ====================
  .delete('/:id', async ({ user, params: { id } }: any) => {
    await NotificationChannelService.delete(id, user.tenantId);
    return { success: true, message: 'Channel deleted successfully' };
  });
