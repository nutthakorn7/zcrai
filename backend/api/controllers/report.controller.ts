import { Elysia, t } from 'elysia';
import { ReportSchedulerService } from '../core/services/report-scheduler.service';
import { tenantGuard } from '../middlewares/auth.middleware';

export const reportController = new Elysia({ prefix: '/reports' })
  .use(tenantGuard)
  
  // List Schedules
  .get('/schedules', async (ctx: any) => {
      return await ReportSchedulerService.listSchedules(ctx.user.tenantId);
  })

  // Create Schedule
  .post('/schedules', async (ctx: any) => {
      const { user, body } = ctx;
      const schedule = await ReportSchedulerService.createSchedule({
          tenantId: user.tenantId,
          ...body,
          recipients: body.recipients,
          nextRunAt: new Date()
      } as any);
      return schedule;
  }, {
      body: t.Object({
          reportType: t.String(),
          frequency: t.String(),
          recipients: t.Array(t.String()),
          isEnabled: t.Boolean()
      }) 
  })

  // Delete Schedule
  .delete('/schedules/:id', async (ctx: any) => {
      await ReportSchedulerService.deleteSchedule(ctx.params.id, ctx.user.tenantId);
      return { success: true };
  });
