import { Elysia, t } from 'elysia';
import { analyticsService } from '../core/services/analytics.service';

export const analyticsController = new Elysia({ prefix: '/api/analytics' })
  .get('/dashboard', async ({ query, set }) => {
    const tenantId = (query as any).tenantId || 'c4f280b2-7589-4b68-8086-53842183c500';

    try {
        const metrics = await analyticsService.getDashboardMetrics(
            tenantId,
            query.startDate,
            query.endDate
        );
        return { success: true, data: metrics };
    } catch (e: any) {
        console.error('Analytics Error:', e);
        set.status = 500;
        return { success: false, message: e.message };
    }
  }, {
    query: t.Object({
        startDate: t.Optional(t.String()),
        endDate: t.Optional(t.String()),
        tenantId: t.Optional(t.String())
    })
  });
