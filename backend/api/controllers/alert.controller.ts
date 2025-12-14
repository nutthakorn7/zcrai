import { Elysia } from 'elysia';
import { jwt } from '@elysiajs/jwt';
import { AlertService } from '../core/services/alert.service';
import { CreateAlertSchema } from '../validators/alert.validator';

export const alertController = new Elysia({ prefix: '/alerts' })
  .use(
    jwt({
        name: 'jwt',
        secret: process.env.JWT_SECRET || 'super_secret_dev_key',
        exp: '1h'
    })
  )
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
  // List alerts
  .get('/', async ({ query, user }: any) => {
    if (!user) throw new Error('Unauthorized');

    const alerts = await AlertService.list({
      tenantId: user.tenantId,
      status: query.status ? query.status.split(',') : undefined,
      severity: query.severity ? query.severity.split(',') : undefined,
      source: query.source ? query.source.split(',') : undefined,
      limit: query.limit ? parseInt(query.limit) : 100,
      offset: query.offset ? parseInt(query.offset) : 0,
    });

    return { success: true, data: alerts };
  })

  // Create alert
  .post('/', async ({ body, user, set }: any) => {
    if (!user) throw new Error('Unauthorized');

    try {
      const alert = await AlertService.create({
        tenantId: user.tenantId,
        ...body,
      });
      return { success: true, data: alert };
    } catch (error: any) {
      console.error('Alert creation failed:', error.message, error.stack);
      set.status = 500;
      return { error: 'Failed to create alert', details: error.message };
    }
  }, { body: CreateAlertSchema })
  // Get alert by ID
  .get('/:id', async ({ params, user }: any) => {
    if (!user) throw new Error('Unauthorized');

    const alert = await AlertService.getById(params.id, user.tenantId);
    return { success: true, data: alert };
  })

  // Mark as reviewing
  .patch('/:id/review', async ({ params, user }: any) => {
    if (!user) throw new Error('Unauthorized');

    const alert = await AlertService.updateStatus(
      params.id,
      user.tenantId,
      'reviewing'
    );

    return { success: true, data: alert };
  })

  // Dismiss alert
  .patch('/:id/dismiss', async ({ params, body, user }: any) => {
    if (!user) throw new Error('Unauthorized');

    const alert = await AlertService.updateStatus(
      params.id,
      user.tenantId,
      'dismissed'
    );

    return { success: true, data: alert };
  })

  // Promote to case
  .post('/:id/promote', async ({ params, body, user }: any) => {
    if (!user) throw new Error('Unauthorized');

    const result = await AlertService.promoteToCase(
      params.id,
      user.tenantId,
      user.id,
      body
    );

    return { success: true, data: result };
  })

  // Bulk dismiss
  .post('/bulk-dismiss', async ({ body, user }: any) => {
    if (!user) throw new Error('Unauthorized');

    const alerts = await AlertService.bulkDismiss(
      body.alertIds,
      user.tenantId,
      user.id,
      body.reason || 'Bulk dismissed'
    );

    return { success: true, data: alerts };
  })

  // Bulk promote
  .post('/bulk-promote', async ({ body, user }: any) => {
    if (!user) throw new Error('Unauthorized');

    const result = await AlertService.bulkPromote(
      body.alertIds,
      user.tenantId,
      user.id,
      body.caseData
    );

    return { success: true, data: result };
  })

  // Get correlations
  .get('/:id/correlations', async ({ params, user }: any) => {
    if (!user) throw new Error('Unauthorized');

    const correlations = await AlertService.getCorrelations(
      params.id,
      user.tenantId
    );

    return { success: true, data: correlations };
  })

  // Get stats
  .get('/stats/summary', async ({ user }: any) => {
    if (!user) throw new Error('Unauthorized');

    const stats = await AlertService.getStats(user.tenantId);
    return { success: true, data: stats };
  });
