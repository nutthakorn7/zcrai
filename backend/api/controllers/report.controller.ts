import { Elysia, t } from 'elysia'
import { ReportService } from '../core/services/report.service'
import { withAuth } from '../middleware/auth'

export const reportController = new Elysia({ prefix: '/reports' })
  .use(withAuth)

  /**
   * Generate Compliance Report (PDF)
   * @route POST /reports/generate
   */
  .post('/generate', async ({ user, body, set }: any) => {
    
    // Role Check
    if (user.role === 'customer') {
        throw new Error('Unauthorized: Reporting requires analyst privileges');
    }

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
        type: t.Union([t.Literal('SOC2'), t.Literal('ISO27001')])
    })
  })
