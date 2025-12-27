import { Elysia, t } from 'elysia';
import { AITraceService } from '../core/services/ai-trace.service';
import { socAnalystOnly } from '../middlewares/auth.middleware';

/**
 * AITraceController
 * Exposes API routes for AI observability and agent trace logs.
 */
export const aiTraceController = new Elysia({ prefix: '/ai/traces' })
  .use(socAnalystOnly) // Requires at least SOC Analyst role

  /**
   * Get agent traces for a specific alert
   * @route GET /ai/traces/alert/:id
   */
  .get('/alert/:id', async ({ user, params }: any) => {
    const traces = await AITraceService.getTracesByAlert(user.tenantId, params.id);
    return { success: true, data: traces };
  }, {
    params: t.Object({
      id: t.String()
    })
  })

  /**
   * Get agent traces for a specific case
   * @route GET /ai/traces/case/:id
   */
  .get('/case/:id', async ({ user, params }: any) => {
    const traces = await AITraceService.getTracesByCase(user.tenantId, params.id);
    return { success: true, data: traces };
  }, {
    params: t.Object({
      id: t.String()
    })
  });
