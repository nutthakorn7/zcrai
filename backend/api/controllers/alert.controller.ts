import { Elysia } from 'elysia';
import { AlertService } from '../core/services/alert.service';

export const alertController = new Elysia({ prefix: '/alerts' })
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
  .post('/', async ({ body, user }: any) => {
    if (!user) throw new Error('Unauthorized');

    const alert = await AlertService.create({
      tenantId: user.tenantId,
      ...body,
    });

    return { success: true, data: alert };
  })

  // Get alert by ID
  .get('/:id', async ({ params, user }: any) => {
    if (!user) throw new Error('Unauthorized');

    const alert = await AlertService.getById(params.id, user.tenantId);
    return { success: true, data: alert };
  })

  // Mark as reviewing
  .patch('/:id/review', async ({ params, user }: any) => {
    if (!user) throw new Error('Unauthorized');

    const alert = await AlertService.review(
      params.id,
      user.tenantId,
      user.id
    );

    return { success: true, data: alert };
  })

  // Dismiss alert
  .patch('/:id/dismiss', async ({ params, body, user }: any) => {
    if (!user) throw new Error('Unauthorized');

    const alert = await AlertService.dismiss(
      params.id,
      user.tenantId,
      user.id,
      body.reason || 'No reason provided'
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
