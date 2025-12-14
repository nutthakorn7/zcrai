import { Elysia, t } from 'elysia';
import { RetentionService } from '../core/services/retention.service';
import { superAdminOnly } from '../middlewares/auth.middleware';

export const systemController = new Elysia({ prefix: '/system' })
  .use(superAdminOnly)
  
  // Get Retention Days
  .get('/retention', async () => {
      const days = await RetentionService.getRetentionDays();
      return { retentionDays: days };
  })

  // Update Retention Days
  .put('/retention', async ({ body }) => {
      const { retentionDays } = body;
      await RetentionService.updateRetentionDays(retentionDays);
      return { message: 'Retention policy updated', retentionDays };
  }, {
      body: t.Object({
          retentionDays: t.Number({ minimum: 1 })
      })
  });
