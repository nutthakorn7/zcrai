/**
 * Investigation Graph Controller
 */

import { Elysia } from 'elysia';
import { tenantGuard } from '../middlewares/auth.middleware';
import { InvestigationGraphService } from '../core/services/investigation-graph.service';

export const graphController = new Elysia({ prefix: '/graph' })
  .use(tenantGuard)

  /**
   * Get investigation graph for a case
   */
  .get('/case/:caseId', async (context) => {
    try {
      const user = (context as any).user;
      const caseId = (context as any).params.caseId;
      const graph = await InvestigationGraphService.buildCaseGraph(caseId, user.tenantId);
      return { success: true, data: graph };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  })

  /**
   * Get investigation graph for an alert
   */
  .get('/alert/:alertId', async (context) => {
    try {
      const user = (context as any).user;
      const alertId = (context as any).params.alertId;
      const graph = await InvestigationGraphService.buildAlertGraph(alertId, user.tenantId);
      return { success: true, data: graph };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });
