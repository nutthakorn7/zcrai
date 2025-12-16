import { Elysia, t } from 'elysia';
import { tenantGuard } from '../middlewares/auth.middleware';
import { analyticsService } from '../core/services/analytics.service';

export const analyticsController = new Elysia({ prefix: '/api/analytics' })
  .use(tenantGuard)
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
