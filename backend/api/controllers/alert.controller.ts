import { Elysia } from 'elysia';
import { withAuth } from '../middleware/auth';
import { AlertService } from '../core/services/alert.service';
import { Errors } from '../middleware/error';
import { HTTP_STATUS } from '../config/constants';
import { CreateAlertSchema } from '../validators/alert.validator';

export const alertController = new Elysia({ prefix: '/alerts' })
  .use(withAuth)
  
  // List alerts
  .get('/', async ({ query, user }: any) => {
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
    const alert = await AlertService.create({
      tenantId: user.tenantId,
      ...body,
    });
    return { success: true, data: alert };
  }, { body: CreateAlertSchema })
  
  // Get alert by ID
  .get('/:id', async ({ params, user }: any) => {
    const alert = await AlertService.getById(params.id, user.tenantId);
    return { success: true, data: alert };
  })

  // Mark as reviewing
  .patch('/:id/review', async ({ params, user }: any) => {
    const alert = await AlertService.updateStatus(
      params.id,
      user.tenantId,
      'reviewing'
    );

    return { success: true, data: alert };
  })

  // Dismiss alert
  .patch('/:id/dismiss', async ({ params, user }: any) => {
    const alert = await AlertService.updateStatus(
      params.id,
      user.tenantId,
      'dismissed'
    );

    return { success: true, data: alert };
  })

  // Promote to case (TODO: Implement)
  .post('/:id/promote', async ({ params, set }: any) => {
    set.status = HTTP_STATUS.NOT_IMPLEMENTED;
    return { success: false, error: 'Not implemented yet' };
  })

  // Bulk dismiss (TODO: Implement)
  .post('/bulk-dismiss', async ({ set }: any) => {
    set.status = HTTP_STATUS.NOT_IMPLEMENTED;
    return { success: false, error: 'Not implemented yet' };
  })

  // Bulk promote (TODO: Implement)
  .post('/bulk-promote', async ({ set }: any) => {
    set.status = HTTP_STATUS.NOT_IMPLEMENTED;
    return { success: false, error: 'Not implemented yet' };
  })

  // Get correlations
  .get('/:id/correlations', async ({ params, user }: any) => {
    const correlations = await AlertService.getCorrelations(
      params.id,
      user.tenantId
    );

    return { success: true, data: correlations };
  })

  // Get stats
  .get('/stats/summary', async ({ user }: any) => {
    const stats = await AlertService.getStats(user.tenantId);
    return { success: true, data: stats };
  })

  // Record analyst feedback (for FP reduction)
  .post('/:id/feedback', async ({ params, body, user }: any) => {
    const { AlertFeedbackService } = await import('../core/services/alert-feedback.service');
    
    await AlertFeedbackService.recordFeedback(user.tenantId, user.id, {
      alertId: params.id,
      feedback: body.feedback,
      reason: body.reason
    });

    return { success: true, message: 'Feedback recorded' };
  })

  // Get FP tuning recommendations
  .get('/tuning/recommendations', async ({ user }: any) => {
    const { AlertFeedbackService } = await import('../core/services/alert-feedback.service');
    
    const recommendations = await AlertFeedbackService.getTuningRecommendations(user.tenantId);
    return { success: true, data: recommendations };
  });
