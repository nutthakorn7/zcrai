import { Elysia } from 'elysia';
import { withAuth, withPermission } from '../middleware/auth';
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
   */
  .get('/', async ({ query, user, set }) => {
    try {
      console.log('[ALERTS] === GET / endpoint called ===');
      if (!user) {
        console.error('[ALERTS] Error: User context missing');
        set.status = 401;
        return { success: false, error: 'Authentication required' };
      }
      console.log('[ALERTS] User:', user?.email, 'Role:', user?.role, 'TenantId:', user?.tenantId);
      
      // Build filters
      const filters: any = {
        limit: query.limit ? parseInt(query.limit) : 100,
        offset: query.offset ? parseInt(query.offset) : 0,
      };
      
      // Only filter by tenantId for non-superadmin users
      if (user.role !== 'superadmin') {
        if (!user.tenantId) {
            console.error('[ALERTS] Error: TenantId missing for user', user.email);
            set.status = 403;
            return { success: false, error: 'Tenant context missing' };
        }
        filters.tenantId = user.tenantId;
        console.log('[ALERTS] Filtering by tenantId:', user.tenantId);
      } else {
        console.log('[ALERTS] Superadmin - showing all tenants');
      }
      
      if (query.status) filters.status = query.status.split(',');
      if (query.severity) filters.severity = query.severity.split(',');
      if (query.source) filters.source = query.source.split(',');
      if (query.aiStatus) filters.aiStatus = query.aiStatus.split(',');
      if (query.fields) filters.fields = query.fields.split(',');
      
      const alerts = await AlertService.list(filters);

      console.log('[ALERTS] Retrieved alerts count:', alerts.length);
      return { success: true, data: alerts };
    } catch (e: any) {
      console.error('[ALERTS] GET / failed:', e.message);
      set.status = 500;
      return { success: false, error: 'Internal Server Error', message: e.message };
    }
  }, {
    beforeHandle: [withPermission('alerts.manage') as any]
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
  }, { 
    body: CreateAlertSchema,
    beforeHandle: [withPermission('alerts.manage') as any]
  })
  
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
  }, {
    beforeHandle: [withPermission('alerts.manage') as any]
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
  }, {
    beforeHandle: [withPermission('alerts.manage') as any]
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
  }, {
    beforeHandle: [withPermission('alerts.manage') as any]
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
  }, {
    beforeHandle: [withPermission('alerts.manage') as any]
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
  }, {
    beforeHandle: [withPermission('alerts.manage') as any]
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
  }, {
    beforeHandle: [withPermission('alerts.manage') as any]
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
  }, {
    beforeHandle: [withPermission('alerts.manage') as any]
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
  }, {
    beforeHandle: [withPermission('alerts.view_results') as any] 
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
  }, {
    beforeHandle: [withPermission('alerts.manage') as any]
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
  }, {
    beforeHandle: [withPermission('alerts.manage') as any]
  })

  /**
   * AI Triage - Analyze and prioritize alerts by urgency
   * @route POST /alerts/triage
   * @access Protected - Requires authentication
   * @body {Array} alerts - Array of alert objects to analyze
   * @returns {Object} Triaged alerts with urgency scores, categories, and actions
   */
  .post('/triage', async ({ body, user, set }: any) => {
    try {
      const { alerts } = body;
      
      if (!alerts || !Array.isArray(alerts) || alerts.length === 0) {
        set.status = 400;
        return { success: false, error: 'alerts array is required' };
      }

      const { AIService } = await import('../core/services/ai.service');
      const result = await AIService.triageAlerts(alerts);

      return { 
        success: true, 
        data: result.triaged,
        message: `Triaged ${result.triaged.length} alerts`
      };
    } catch (e: any) {
      console.error('[ALERTS] Triage failed:', e.message);
      set.status = 500;
      return { success: false, error: 'AI Triage failed', message: e.message };
    }
  }, {
    beforeHandle: [withPermission('alerts.manage') as any]
  });
