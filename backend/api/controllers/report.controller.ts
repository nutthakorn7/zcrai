import { Elysia } from 'elysia';
import { jwt } from '@elysiajs/jwt';
import { ReportService } from '../core/services/report.service';
import { tenantAdminOnly } from '../middlewares/auth.middleware';

export const reportController = new Elysia({ prefix: '/reports' })
  .use(jwt({
    name: 'jwt',
    secret: process.env.JWT_SECRET || 'super_secret_dev_key',
  }))
  .use(tenantAdminOnly)

  // ==================== DASHBOARD PDF ====================
  .get('/dashboard/pdf', async ({ user, query, set }: any) => {
    try {
      const pdf = await ReportService.generateDashboardPDF(user.tenantId, {
        startDate: query.startDate,
        endDate: query.endDate,
        title: query.title || 'Security Dashboard Report'
      });

      set.headers['Content-Type'] = 'application/pdf';
      set.headers['Content-Disposition'] = `attachment; filename="dashboard-report-${Date.now()}.pdf"`;
      
      return pdf;
    } catch (error: any) {
      set.status = 500;
      return { error: 'Failed to generate PDF report', details: error.message };
    }
  })

  // ==================== ALERT REPORT PDF ====================
  .get('/alerts/pdf', async ({ user, query, set }: any) => {
    try {
      const pdf = await ReportService.generateAlertReportPDF(user.tenantId, {
        severity: query.severity?.split(','),
        status: query.status?.split(','),
        limit: query.limit ? parseInt(query.limit) : 100
      });

      set.headers['Content-Type'] = 'application/pdf';
      set.headers['Content-Disposition'] = `attachment; filename="alert-report-${Date.now()}.pdf"`;
      
      return pdf;
    } catch (error: any) {
      set.status = 500;
      return { error: 'Failed to generate alert report', details: error.message };
    }
  })

  // ==================== CASE REPORT PDF ====================
  .get('/cases/:id/pdf', async ({ user, params: { id }, set }: any) => {
    try {
      const pdf = await ReportService.generateCaseReportPDF(id, user.tenantId);

      set.headers['Content-Type'] = 'application/pdf';
      set.headers['Content-Disposition'] = `attachment; filename="case-${id}-report.pdf"`;
      
      return pdf;
    } catch (error: any) {
      set.status = 500;
      return { error: 'Failed to generate case report', details: error.message };
    }
  });
