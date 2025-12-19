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
    console.log('[ALERTS] === GET / endpoint called ===');
    console.log('[ALERTS] User:', user?.email, 'Role:', user?.role, 'TenantId:', user?.tenantId);
    
    // Build filters - superadmin can see all tenants, regular users only their tenant
    const filters: any = {
      limit: query.limit ? parseInt(query.limit) : 100,
      offset: query.offset ? parseInt(query.offset) : 0,
    };
    
    // Only filter by tenantId for non-superadmin users
    if (user.role !== 'superadmin') {
      filters.tenantId = user.tenantId;
      console.log('[ALERTS] Filtering by tenantId:', user.tenantId);
    } else {
      console.log('[ALERTS] Superadmin - showing all tenants');
    }
    
    if (query.status) filters.status = query.status.split(',');
    if (query.severity) filters.severity = query.severity.split(',');
    if (query.source) filters.source = query.source.split(',');
    
    const alerts = await AlertService.list(filters);

    console.log('[ALERTS] Retrieved alerts count:', alerts.length);
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
   * @returns {Object} Created case and updated alert
   */
  .post('/:id/promote', async ({ params, user }: any) => {
    const result = await AlertService.promoteToCase(
      params.id,
      user.tenantId,
      user.id
    );

    return { 
      success: true, 
      message: 'Alert promoted to case successfully',
      data: result 
    };
  })

  /**
   * Bulk dismiss multiple alerts at once
   * @route POST /alerts/bulk-dismiss
   * @access Protected - Requires authentication
   * @body {string[]} alertIds - Array of alert IDs to dismiss
   * @returns {Object} Count of dismissed alerts
   */
  .post('/bulk-dismiss', async ({ body, user }: any) => {
    const { alertIds } = body;
    
    if (!alertIds || !Array.isArray(alertIds) || alertIds.length === 0) {
      return { 
        success: false, 
        error: 'alertIds array is required' 
      };
    }

    const result = await AlertService.bulkDismiss(alertIds, user.tenantId);

    return {
      success: true,
      message: `${result.count} alerts dismissed successfully`,
      data: result
    };
  })

  /**
   * Bulk promote multiple alerts to cases
   * @route POST /alerts/bulk-promote
   * @access Protected - Requires authentication
   * @body {string[]} alertIds - Array of alert IDs to promote
   * @returns {Object} Count of created cases
   */
  .post('/bulk-promote', async ({ body, user }: any) => {
    const { alertIds } = body;
    
    if (!alertIds || !Array.isArray(alertIds) || alertIds.length === 0) {
      return { 
        success: false, 
        error: 'alertIds array is required' 
      };
    }

    const result = await AlertService.bulkPromote(
      alertIds, 
      user.tenantId,
      user.id
    );

    return {
      success: true,
      message: `${result.count} alerts promoted to cases successfully`,
      data: result
    };
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
