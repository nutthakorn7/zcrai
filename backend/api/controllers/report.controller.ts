import { Elysia, t } from 'elysia';
import { ReportSchedulerService } from '../core/services/report-scheduler.service';
import { tenantGuard } from '../middlewares/auth.middleware';

export const reportController = new Elysia({ prefix: '/reports' })
  .use(tenantGuard)
  
  // List Schedules
  .get('/schedules', async ({ user }) => {
      return await ReportSchedulerService.listSchedules(user.tenantId);
  })

  // Create Schedule
  .post('/schedules', async ({ user, body }) => {
      const schedule = await ReportSchedulerService.createSchedule({
          tenantId: user.tenantId,
          ...body,
          recipients: body.recipients,
          nextRunAt: new Date() // Will be recalculated by service? Actually service handles it. Pass simple date. Wait, `createSchedule` calculates it.
      } as any);
      return schedule;
  }, {
      body: t.Object({
          reportType: t.String(), // 'dashboard', 'iso27001'
          frequency: t.String(), // 'daily', 'weekly'
          recipients: t.Array(t.String()),
          isEnabled: t.Boolean()
      }) 
  })

  // Delete Schedule
  .delete('/schedules/:id', async ({ user, params }) => {
      await ReportSchedulerService.deleteSchedule(params.id, user.tenantId);
      return { success: true };
  });
