/**
 * Investigation Graph Controller
 * Visualizes relationships between entities (cases, alerts, observables, users)
 */

import { Elysia } from 'elysia';
import { withAuth } from '../middleware/auth';
import { InvestigationGraphService } from '../core/services/investigation-graph.service';
import { TimelineService } from '../core/services/timeline.service';

export const graphController = new Elysia({ prefix: '/graph' })
  .use(withAuth)

  /**
   * Get Consolidated Timeline
   */
   .get('/timeline/:alertId', async ({ user, params: { alertId } }: any) => {
       const events = await TimelineService.getTimeline(user.tenantId, alertId);
       return { success: true, data: events };
   })

  /**
   * Get investigation graph for a case
   * @route GET /graph/case/:caseId
   * @access Protected - Requires authentication
   * @param {string} caseId - Case ID
   * @returns {Object} Graph nodes and edges (alerts, observables, relationships)
   * @description Builds visual graph showing all related entities and connections
   */
  .get('/case/:caseId', async (context) => {
    const user = (context as any).user;
    const caseId = (context as any).params.caseId;
    const graph = await InvestigationGraphService.buildCaseGraph(caseId, user.tenantId);
    return { success: true, data: graph };
  })

  /**
   * Get investigation graph for an alert
   * @route GET /graph/alert/:alertId
   * @access Protected - Requires authentication
   * @param {string} alertId - Alert ID
   * @returns {Object} Graph nodes and edges for alert investigation
   * @description Shows correlated alerts, observables, and affected assets
   */
  .get('/alert/:alertId', async (context) => {
    const user = (context as any).user;
    const alertId = (context as any).params.alertId;
    const graph = await InvestigationGraphService.buildAlertGraph(alertId, user.tenantId);
    return { success: true, data: graph };
  });
