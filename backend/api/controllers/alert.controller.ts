import { Elysia } from 'elysia';
import { withAuth } from '../middleware/auth';
import { AlertService } from '../core/services/alert.service';
import { Errors } from '../middleware/error';
import { HTTP_STATUS } from '../config/constants';
import { CreateAlertSchema } from '../validators/alert.validator';

export const alertController = new Elysia({ prefix: '/alerts' })
  .use(withAuth)
  
  /**
   * List alerts with optional filtering
   * @route GET /alerts
   * @access Protected - Requires authentication
   * @query {string} status - Filter by status (open, reviewing, dismissed) - comma-separated
   * @query {string} severity - Filter by severity (critical, high, medium, low) - comma-separated
   * @query {string} source - Filter by alert source - comma-separated
   * @query {number} limit - Max results to return (default: 100)
   * @query {number} offset - Pagination offset (default: 0)
   * @returns {Object} Filtered list of alerts
   */
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

  /**
   * Create a new security alert
   * @route POST /alerts
   * @access Protected - Requires authentication
   * @body {string} title - Alert title
   * @body {string} severity - Severity level
   * @body {string} source - Alert source system
   * @returns {Object} Created alert data
   */
  .post('/', async ({ body, user }: any) => {
    const alert = await AlertService.create({
      tenantId: user.tenantId,
      ...body,
    });
    return { success: true, data: alert };
  }, { body: CreateAlertSchema })
  
  /**
   * Get detailed information for a specific alert
   * @route GET /alerts/:id
   * @access Protected - Requires authentication
   * @param {string} id - Alert ID
   * @returns {Object} Alert details with all metadata
   */
  .get('/:id', async ({ params, user }: any) => {
    const alert = await AlertService.getById(params.id, user.tenantId);
    return { success: true, data: alert };
  })

  /**
   * Mark an alert as under review
   * @route PATCH /alerts/:id/review
   * @access Protected - Requires authentication
   * @param {string} id - Alert ID
   * @returns {Object} Updated alert with 'reviewing' status
   */
  .patch('/:id/review', async ({ params, user }: any) => {
    const alert = await AlertService.updateStatus(
      params.id,
      user.tenantId,
      'reviewing'
    );

    return { success: true, data: alert };
  })

  /**
   * Dismiss an alert as false positive or resolved
   * @route PATCH /alerts/:id/dismiss
   * @access Protected - Requires authentication
   * @param {string} id - Alert ID
   * @returns {Object} Updated alert with 'dismissed' status
   */
  .patch('/:id/dismiss', async ({ params, user }: any) => {
    const alert = await AlertService.updateStatus(
      params.id,
      user.tenantId,
      'dismissed'
    );

    return { success: true, data: alert };
  })

  /**
   * Promote alert to a security case for investigation
   * @route POST /alerts/:id/promote
   * @access Protected - Requires authentication
   * @param {string} id - Alert ID
   * @returns {Object} Success status
   * @todo Implement AlertService.promoteToCase
   */
  .post('/:id/promote', async ({ params, set }: any) => {
    set.status = HTTP_STATUS.NOT_IMPLEMENTED;
    return { success: false, error: 'Not implemented yet' };
  })

  /**
   * Bulk dismiss multiple alerts at once
   * @route POST /alerts/bulk-dismiss
   * @access Protected - Requires authentication
   * @body {string[]} alertIds - Array of alert IDs to dismiss
   * @returns {Object} Success status
   * @todo Implement AlertService.bulkDismiss
   */
  .post('/bulk-dismiss', async ({ set }: any) => {
    set.status = HTTP_STATUS.NOT_IMPLEMENTED;
    return { success: false, error: 'Not implemented yet' };
  })

  /**
   * Bulk promote multiple alerts to cases
   * @route POST /alerts/bulk-promote
   * @access Protected - Requires authentication
   * @body {string[]} alertIds - Array of alert IDs to promote
   * @returns {Object} Success status
   * @todo Implement AlertService.bulkPromote
   */
  .post('/bulk-promote', async ({ set }: any) => {
    set.status = HTTP_STATUS.NOT_IMPLEMENTED;
    return { success: false, error: 'Not implemented yet' };
  })

  /**
   * Get correlated alerts related to this alert
   * @route GET /alerts/:id/correlations
   * @access Protected - Requires authentication
   * @param {string} id - Alert ID
   * @returns {Object} List of related/correlated alerts
   */
  .get('/:id/correlations', async ({ params, user }: any) => {
    const correlations = await AlertService.getCorrelations(
      params.id,
      user.tenantId
    );

    return { success: true, data: correlations };
  })

  /**
   * Get alert statistics and summary metrics
   * @route GET /alerts/stats/summary
   * @access Protected - Requires authentication
   * @returns {Object} Alert statistics (total, by severity, by status)
   */
  .get('/stats/summary', async ({ user }: any) => {
    const stats = await AlertService.getStats(user.tenantId);
    return { success: true, data: stats };
  })

  /**
   * Record analyst feedback to improve false positive detection
   * @route POST /alerts/:id/feedback
   * @access Protected - Requires authentication
   * @param {string} id - Alert ID
   * @body {string} feedback - Feedback type (true_positive, false_positive, etc.)
   * @body {string} reason - Reason for the feedback
   * @returns {Object} Success message
   */
  .post('/:id/feedback', async ({ params, body, user }: any) => {
    const { AlertFeedbackService } = await import('../core/services/alert-feedback.service');
    
    await AlertFeedbackService.recordFeedback(user.tenantId, user.id, {
      alertId: params.id,
      feedback: body.feedback,
      reason: body.reason
    });

    return { success: true, message: 'Feedback recorded' };
  })

  /**
   * Get tuning recommendations based on feedback patterns
   * @route GET /alerts/tuning/recommendations
   * @access Protected - Requires authentication
   * @returns {Object} Recommendations to reduce false positives
   */
  .get('/tuning/recommendations', async ({ user }: any) => {
    const { AlertFeedbackService } = await import('../core/services/alert-feedback.service');
    
    const recommendations = await AlertFeedbackService.getTuningRecommendations(user.tenantId);
    return { success: true, data: recommendations };
  });
