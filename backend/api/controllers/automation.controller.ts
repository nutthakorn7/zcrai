import { Elysia, t } from 'elysia'
import { SoarService } from '../core/services/soar.service'
import { protectedRoute } from '../middlewares/auth.middleware'

export const automationController = new Elysia({ prefix: '/automation' })
  .use(protectedRoute)
  
  /**
   * Get recent autonomous actions with alert context
   * @route GET /automation/stream
   */
  .get('/stream', async ({ set, user }: any) => {
    try {
      const actions = await SoarService.getRecentAutopilotActions(user.tenantId, 20);
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
  .get('/stats', async ({ set, user }: any) => {
    try {
      const stats = await SoarService.getAutopilotStats(user.tenantId);
      return { success: true, data: stats };
    } catch (e: any) {
      set.status = 500;
      return { success: false, error: e.message };
    }
  })
