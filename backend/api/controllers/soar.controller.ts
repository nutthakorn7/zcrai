import { Elysia, t } from 'elysia'
import { SOARService, SOARActionRequest } from '../core/services/soar.service'
import { tenantAdminOnly, socAnalystOnly } from '../middlewares/auth.middleware'

/**
 * SOAR Controller
 * Handles API requests for integration secrets management and action execution.
 */
export const soarController = new Elysia({ prefix: '/soar' })
  .use(socAnalystOnly) // Base level: SOC Analysts can view integrations and execute actions

  /**
   * List configured integrations for the tenant
   * @route GET /soar/integrations
   */
  .get('/integrations', async ({ user }: any) => {
    const integrations = await SOARService.listIntegrations(user.tenantId);
    return { success: true, data: integrations };
  })

  /**
   * Save or update integration credentials (Secrets Vault)
   * Only accessible by Admins.
   * @route POST /soar/secrets
   */
  .post('/secrets', async ({ user, body }: any) => {
    await SOARService.saveCredentials(user.tenantId, body.provider, body.data);
    return { success: true, message: 'Credentials saved successfully' };
  }, {
    beforeHandle: [tenantAdminOnly.onBeforeHandle as any],
    body: t.Object({
      provider: t.String(),
      data: t.Any()
    })
  })

  /**
   * Remove an integration
   * Only accessible by Admins.
   * @route DELETE /soar/secrets/:id
   */
  .delete('/secrets/:id', async ({ user, params }: any) => {
    await SOARService.deleteIntegration(user.tenantId, params.id);
    return { success: true };
  }, {
    beforeHandle: [tenantAdminOnly.onBeforeHandle as any]
  })

  /**
   * Execute an active response action (Mocked)
   * @route POST /soar/execute
   */
  .post('/execute', async ({ user, body, set }: any) => {
    try {
      const { alertId, caseId, actionType, provider, target } = body as any;
      const result = await SOARService.executeAction(user.tenantId, {
        alertId,
        caseId,
        actionType,
        provider,
        target,
        userId: user.id
      } as SOARActionRequest);
      return { success: true, ...result };
    } catch (error: any) {
      console.error('[SOARController] Action execution failed:', error);
      set.status = 500;
      return { success: false, error: error.message };
    }
  }, {
    body: t.Object({
      alertId: t.Optional(t.String()),
      caseId: t.Optional(t.String()),
      actionType: t.Union([
        t.Literal('BLOCK_IP'),
        t.Literal('ISOLATE_HOST'),
        t.Literal('RESCIND_EMAIL'),
        t.Literal('KILL_PROCESS')
      ]),
      provider: t.String(),
      target: t.String()
    })
  })

  /**
   * Retrieve audit logs of SOAR actions
   * @route GET /soar/logs
   */
  .get('/logs', async ({ user }: any) => {
      const logs = await SOARService.getActionLogs(user.tenantId);
      return { success: true, data: logs };
  });
