import { Elysia, t } from 'elysia';
import { tenantGuard } from '../middlewares/auth.middleware';
import { analyticsService } from '../core/services/analytics.service';

export const analyticsController = new Elysia({ prefix: '/api/analytics' })
  .use(tenantGuard)
  
  /**
   * Get analytics dashboard metrics
   * @route GET /api/analytics/dashboard
   * @access Protected - Requires authentication
   * @query {string} startDate - Start date (YYYY-MM-DD) (optional)
   * @query {string} endDate - End date (YYYY-MM-DD) (optional)
   * @query {string} tenantId - Tenant ID (optional, for superadmin)
   * @returns {Object} Dashboard metrics (events, alerts, trends)
   * @description Aggregated security metrics for analytics dashboards
   */
  .get('/dashboard', async ({ query, user }: any) => {
    const tenantId = user?.tenantId || (query as any).tenantId;
    
    const metrics = await analyticsService.getDashboardMetrics(
      tenantId,
      query.startDate,
      query.endDate
    );
    return { success: true, data: metrics };
  }, {
    query: t.Object({
      startDate: t.Optional(t.String()),
      endDate: t.Optional(t.String()),
      tenantId: t.Optional(t.String())
    })
  });
