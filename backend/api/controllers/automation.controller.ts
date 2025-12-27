import { Elysia, t } from 'elysia'
import { SoarService } from '../core/services/soar.service'
import { withAuth } from '../middleware/auth'
import { getEffectiveTenantId } from '../core/utils/tenant'

export const automationController = new Elysia({ prefix: '/automation' })
  .use(withAuth)
  
  /**
   * Get recent autonomous actions with alert context
   * @route GET /automation/stream
   */
  .get('/stream', async ({ set, user, cookie: { selected_tenant } }: any) => {
    try {
      const tenantId = getEffectiveTenantId(user, selected_tenant);
      const actions = await SoarService.getRecentAutopilotActions(tenantId, 20);
      return { success: true, data: actions };
    } catch (e: any) {
      set.status = 500;
      return { success: false, error: e.message };
    }
  })

  /**
   * Get Autopilot ROI metrics
   * @route GET /automation/stats
   */
  .get('/stats', async ({ set, user, cookie: { selected_tenant } }: any) => {
    try {
      const tenantId = getEffectiveTenantId(user, selected_tenant);
      const stats = await SoarService.getAutopilotStats(tenantId);
      return { success: true, data: stats };
    } catch (e: any) {
      set.status = 500;
      return { success: false, error: e.message };
    }
  })
