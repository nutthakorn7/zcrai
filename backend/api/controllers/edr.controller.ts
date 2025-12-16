/**
 * EDR Actions Controller
 * API routes for EDR response actions (CrowdStrike, SentinelOne)
 */

import { Elysia, t } from 'elysia';
import { withAuth } from '../middleware/auth';
import { EDRActionService } from '../core/services/edr-action.service';

export const edrController = new Elysia({ prefix: '/edr' })
  .use(withAuth)
  
  /**
   * Execute EDR response action on endpoint
   * @route POST /edr/execute
   * @access Protected - Requires authentication
   * @body {string} provider - EDR provider (crowdstrike, sentinelone)
   * @body {string} action - Action to execute (isolate_host, kill_process, etc.)
   * @body {object} parameters - Action-specific parameters (hostId, processId, etc.)
   * @body {string} executionStepId - Execution step ID (optional)
   * @returns {Object} Action execution result
   * @description Executes containment/remediation actions via EDR APIs
   */
  .post('/execute', async ({ body }: any) => {
    const { provider, action, parameters, executionStepId } = body;

    const result = await EDRActionService.executeAction({
      provider,
      action,
      parameters,
      executionStepId: executionStepId || 'manual-' + Date.now(),
    });

    return {
      success: result.success,
      message: result.success ? 'Action executed successfully' : 'Action failed',
      data: result,
    };
  }, {
    body: t.Object({
      provider: t.String(),
      action: t.String(),
      parameters: t.Record(t.String(), t.Any()),
      executionStepId: t.Optional(t.String()),
    }),
  })

  /**
   * Get available EDR actions for provider
   * @route GET /edr/providers/:provider/actions
   * @access Protected - Requires authentication
   * @param {string} provider - EDR provider (crowdstrike, sentinelone)
   * @returns {Object} List of available actions with metadata
   * @description Returns available containment/response actions per provider
   */
  .get('/providers/:provider/actions', ({ params }: any) => {
    const { provider } = params;
    
    const actions: Record<string, any[]> = {
      crowdstrike: [
        { key: 'isolate_host', label: 'Isolate Host', dangerous: true },
        { key: 'lift_containment', label: 'Lift Containment', dangerous: false },
        { key: 'kill_process', label: 'Kill Process', dangerous: true },
        { key: 'get_device_details', label: 'Get Device Details', dangerous: false },
      ],
      sentinelone: [
        { key: 'quarantine_host', label: 'Quarantine Host', dangerous: true },
        { key: 'unquarantine_host', label: 'Unquarantine Host', dangerous: false },
        { key: 'blocklist_hash', label: 'Blocklist Hash', dangerous: true },
        { key: 'get_agent_details', label: 'Get Agent Details', dangerous: false },
      ],
    };

    return {
      success: true,
      data: actions[provider] || [],
    };
  })

  /**
   * Get EDR action execution history
   * @route GET /edr/history
   * @access Protected - Requires authentication
   * @query {number} limit - Max results (default: 50)
   * @returns {Object} List of past EDR actions executed
   * @todo Implement actual history retrieval from database
   */
  .get('/history', async ({ query }: any) => {
    const { limit = 50 } = query;
    
    return {
      success: true,
      data: [],
      total: 0,
    };
  });
