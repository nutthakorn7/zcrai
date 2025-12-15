/**
 * EDR Actions Controller
 * API routes for EDR response actions
 */

import { Elysia, t } from 'elysia';
import { withAuth } from '../middleware/auth';
import { EDRActionService } from '../core/services/edr-action.service';

export const edrController = new Elysia({ prefix: '/edr' })
  .use(withAuth)
  
  /**
   * Execute EDR action
   */
  .post('/execute', async ({ body, set }: any) => {
    try {
      const { provider, action, parameters, executionStepId } = body;

      const result = await EDRActionService.executeAction({
        provider,
        action,
        parameters,
        executionStepId: executionStepId || 'manual-' + Date.now(), // Default for manual executions
      });

      return {
        success: result.success,
        message: result.success ? 'Action executed successfully' : 'Action failed',
        data: result,
      };
    } catch (error: any) {
      set.status = 500;
      return { 
        success: false, 
        error: error.message || 'Failed to execute EDR action' 
      };
    }
  }, {
    body: t.Object({
      provider: t.String(),
      action: t.String(),
      parameters: t.Record(t.String(), t.Any()),
      executionStepId: t.Optional(t.String()),
    }),
  })

  /**
   * Get available actions for provider
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
   * Get action history
   */
  .get('/history', async ({ query }: any) => {
    const { limit = 50 } = query;
    
    return {
      success: true,
      data: [],
      total: 0,
    };
  });
