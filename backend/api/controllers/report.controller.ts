import { Elysia, t } from 'elysia';
import { ReportSchedulerService } from '../core/services/report-scheduler.service';
import { tenantGuard } from '../middlewares/auth.middleware';

export const reportController = new Elysia({ prefix: '/reports' })
  .use(tenantGuard)
  
  /**
   * List scheduled reports
   * @route GET /reports/schedules
   * @access Protected - Requires authentication
   * @returns {Object} List of report schedules
   */
  .get('/schedules', async ({ jwt, cookie: { access_token }, set }) => {
      // Manual Auth Check (Fixing middleware context issue)
      if (!access_token?.value) {
          set.status = 401
          throw new Error('Unauthorized')
      }
      const payload = await jwt.verify(access_token.value as string)
      if (!payload) {
          set.status = 401
          throw new Error('Invalid token')
      }
      const user = payload as any
      
      return await ReportSchedulerService.listSchedules(user.tenantId);
  })

  /**
   * Create scheduled report
   * @route POST /reports/schedules
   * @access Protected - Requires authentication
   * @body {string} reportType - Report type (summary, detailed, compliance)
   * @body {string} frequency - Schedule frequency (daily, weekly, monthly)
   * @body {array} recipients - Email recipients
   * @body {boolean} isEnabled - Enable/disable schedule
   * @returns {Object} Created schedule
   */
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

  /**
   * Delete scheduled report
   * @route DELETE /reports/schedules/:id
   * @access Protected - Requires authentication
   * @param {string} id - Schedule ID
   * @returns {Object} Success status
   */
  .delete('/schedules/:id', async (ctx: any) => {
      await ReportSchedulerService.deleteSchedule(ctx.params.id, ctx.user.tenantId);
      return { success: true };
  });
