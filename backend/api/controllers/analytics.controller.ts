import { Elysia, t } from 'elysia'
import { analyticsService } from '../services/analytics.service'
import { withAuth } from '../middleware/auth'
import { getEffectiveTenantId } from '../core/utils/tenant'

export const analyticsController = new Elysia({ prefix: '/analytics' })
  .use(withAuth)
  .get('/insights', async ({ user, cookie: { selected_tenant }, query, set }) => {
    try {
      const tenantId = getEffectiveTenantId(user, selected_tenant)
      const days = query.days ? parseInt(query.days) : 7
      
      return await analyticsService.getInsightsData(tenantId, days);
    } catch (e: any) {
      set.status = 400
      return { error: e.message }
    }
  }, {
    query: t.Object({
      days: t.Optional(t.String())
    })
  })
