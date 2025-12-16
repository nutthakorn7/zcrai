import { Elysia, t } from 'elysia';
import { CloudIntegrationService } from '../core/services/cloud-integration.service';
import { tenantGuard } from '../middlewares/auth.middleware';

export const cloudController = new Elysia({ prefix: '/cloud' })
  .use(tenantGuard)

  /**
   * List cloud provider integrations
   * @route GET /cloud/integrations
   * @access Protected - Requires authentication
   * @returns {Object} List of configured cloud integrations (AWS, M365, GCP)
   */
  .get('/integrations', async (ctx: any) => {
      return await CloudIntegrationService.list(ctx.user.tenantId);
  })

  /**
   * Create cloud provider integration
   * @route POST /cloud/integrations
   * @access Protected - Requires authentication
   * @body {string} provider - Cloud provider (aws, m365, gcp)
   * @body {string} name - Integration name
   * @body {object} config - Provider-specific configuration
   * @body {object} credentials - Authentication credentials
   * @returns {Object} Created integration
   * @description Connect to AWS CloudTrail, M365 Audit Logs, etc.
   */
  .post('/integrations', async (ctx: any) => {
      const { user, body } = ctx;
      const integration = await CloudIntegrationService.create({
          tenantId: user.tenantId,
          provider: body.provider,
          name: body.name,
          config: body.config,
          credentials: body.credentials
      });
      return integration;
  }, {
      body: t.Union([
          // AWS Schema
          t.Object({
              provider: t.Literal('aws'), 
              name: t.String(),
              config: t.Object({
                  region: t.String(),
                  logGroups: t.Optional(t.Array(t.String()))
              }),
              credentials: t.Object({
                  accessKeyId: t.String(),
                  secretAccessKey: t.String()
              })
          }),
          // M365 Schema
          t.Object({
              provider: t.Literal('m365'),
              name: t.String(),
              config: t.Object({
                  tenantId: t.String()
              }),
              credentials: t.Object({
                  clientId: t.String(),
                  clientSecret: t.String()
              })
          })
      ])
  })

  /**
   * Test cloud integration connection
   * @route POST /cloud/integrations/:id/test
   * @access Protected - Requires authentication
   * @param {string} id - Integration ID
   * @returns {Object} Connection test result
   * @throws {400} Connection failed
   */
  .post('/integrations/:id/test', async (ctx: any) => {
      return await CloudIntegrationService.testConnection(ctx.params.id, ctx.user.tenantId);
  })

  /**
   * Delete cloud integration
   * @route DELETE /cloud/integrations/:id
   * @access Protected - Requires authentication
   * @param {string} id - Integration ID
   * @returns {Object} Success status
   */
  .delete('/integrations/:id', async (ctx: any) => {
      await CloudIntegrationService.delete(ctx.params.id, ctx.user.tenantId);
      return { success: true };
  });
