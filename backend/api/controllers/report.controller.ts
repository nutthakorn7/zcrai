import { Elysia, t } from 'elysia'
import { ReportService } from '../core/services/report.service'
import { ReportSchedulerService } from '../core/services/report-scheduler.service'
import { socAnalystOnly, superAdminOnly } from '../middlewares/auth.middleware'
import { db } from '../infra/db'
import { tenants } from '../infra/db/schema'
import { sql, desc } from 'drizzle-orm'

export const reportController = new Elysia({ prefix: '/reports' })
  .use(socAnalystOnly) // Base level: SOC Analysts can generate reports

  /**
   * Generate Compliance Report (PDF)
   * @route POST /reports/generate
   */
  .post('/generate', async ({ user, body, set }: any) => {
    try {
        const pdfBuffer = await ReportService.generateReport(user.tenantId, body.type);

        return new Response(pdfBuffer, {
            headers: {
                'Content-Type': 'application/pdf',
                'Content-Disposition': `attachment; filename="zcrAI_${body.type}_Report.pdf"`,
                'Content-Length': pdfBuffer.length.toString()
            }
        });

    } catch (error: any) {
        console.error("Report Generation Failed:", error);
        set.status = 500;
        return { success: false, message: "Failed to generate report", error: error.message };
    }
  }, {
    body: t.Object({
        type: t.Union([t.Literal('SOC2'), t.Literal('ISO27001'), t.Literal('NIST'), t.Literal('PDPA'), t.Literal('AI_ACCURACY')])
    })
  })

  /**
   * Get Weekly Stats (ROI & Threats) for Dashboard
   * @route GET /reports/stats
   */
  .get('/stats', async ({ user }: any) => {
    try {
        const stats = await ReportService.getWeeklyStats(user.tenantId);
        return { success: true, data: stats };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
  })

  // ==================== SCHEDULES ====================

  /**
   * List Schedules
   * @route GET /reports/schedules
   */
  .get('/schedules', async ({ user }: any) => {
    return await ReportSchedulerService.listSchedules(user.tenantId);
  })

  /**
   * Create Schedule
   * @route POST /reports/schedules
   */
  .post('/schedules', async ({ user, body }: any) => {
    return await ReportSchedulerService.createSchedule({
        ...body,
        tenantId: user.tenantId,
        lastRunAt: null,
        nextRunAt: new Date(), // Logic in service will overwrite this or we let service handle
        isEnabled: true,
        createdBy: user.id
    });
  }, {
    body: t.Object({
        reportType: t.String(),
        frequency: t.Union([t.Literal('daily'), t.Literal('weekly'), t.Literal('monthly')]),
        recipients: t.Array(t.String()) // JSONB array of emails
    })
  })

  /**
   * Delete Schedule
   * @route DELETE /reports/schedules/:id
   */
  .delete('/schedules/:id', async ({ user, params }: any) => {
    await ReportSchedulerService.deleteSchedule(params.id, user.tenantId);
    return { success: true };
  })

  /**
   * Batch Reporting for MSSP Admins (SuperAdmin only)
   * Generates reports for all active tenants.
   */
  .post('/batch-generate', async ({ set, body }: any) => {
    try {
        const allTenants = await db.select().from(tenants).where(sql`status = 'active'`);
        const reportType = body.type;
        
        console.log(`[BatchReport] Starting generation for ${allTenants.length} tenants. Type: ${reportType}`);
        
        // In a real world, this would be an async job with ZIP output
        // For now, we'll return a sumamry or the first one as proof
        const results = [];
        for (const tenant of allTenants) {
            try {
                // Pre-warm/Trigger but don't wait for all if too many
                await ReportService.generateReport(tenant.id, reportType);
                results.push({ tenantId: tenant.id, name: tenant.name, status: 'success' });
            } catch (e: any) {
                results.push({ tenantId: tenant.id, name: tenant.name, status: 'failed', error: e.message });
            }
        }

        return { success: true, processed: results.length, results };
    } catch (e: any) {
        set.status = 500;
        return { success: false, error: e.message };
    }
  }, {
    beforeHandle: [superAdminOnly.onBeforeHandle as any], // Elevation to SuperAdmin
    body: t.Object({
        type: t.Union([t.Literal('SOC2'), t.Literal('ISO27001'), t.Literal('NIST'), t.Literal('PDPA')])
    })
  })
