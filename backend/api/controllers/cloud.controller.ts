import { Elysia, t } from 'elysia';
import { CloudIntegrationService } from '../core/services/cloud-integration.service';
import { tenantGuard } from '../middlewares/auth.middleware';

export const cloudController = new Elysia({ prefix: '/cloud' })
  .use(tenantGuard)

  // List Integrations
  .get('/integrations', async (ctx: any) => {
      return await CloudIntegrationService.list(ctx.user.tenantId);
  })

  // Create Integration
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

  // Test Connection
  .post('/integrations/:id/test', async (ctx: any) => {
      return await CloudIntegrationService.testConnection(ctx.params.id, ctx.user.tenantId);
  })

  // Delete Integration
  .delete('/integrations/:id', async (ctx: any) => {
      await CloudIntegrationService.delete(ctx.params.id, ctx.user.tenantId);
      return { success: true };
  });
