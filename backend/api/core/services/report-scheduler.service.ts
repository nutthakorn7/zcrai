import { db } from '../../infra/db';
import { reportSchedules } from '../../infra/db/schema';
import { eq, and, lte } from 'drizzle-orm';
import { ReportService } from './report.service';
import { EmailService } from './email.service';

export const ReportSchedulerService = {
  
  // Create Plan
  async createSchedule(data: typeof reportSchedules.$inferInsert) {
      // Calculate Next Run
      const nextRun = this.calculateNextRun(data.frequency);
      
      const [schedule] = await db.insert(reportSchedules).values({
          ...data,
          nextRunAt: nextRun
      }).returning();
      
      return schedule;
  },

  async deleteSchedule(id: string, tenantId: string) {
      await db.delete(reportSchedules)
        .where(and(eq(reportSchedules.id, id), eq(reportSchedules.tenantId, tenantId)));
  },
  
  async listSchedules(tenantId: string) {
      return await db.select().from(reportSchedules).where(eq(reportSchedules.tenantId, tenantId));
  },

  /**
   * Main Worker: Process reports due for generation
   */
  async processDueReports() {
     console.log('📄 Checking for due reports...');
     const now = new Date();

     const dueSchedules = await db
        .select()
        .from(reportSchedules)
        .where(and(
            eq(reportSchedules.isEnabled, true),
            lte(reportSchedules.nextRunAt, now)
        ));

     console.log(`Found ${dueSchedules.length} reports to process.`);

     for (const schedule of dueSchedules) {
         try {
             await this.generateAndSend(schedule);
             
             // Update Next Run
             const nextRun = this.calculateNextRun(schedule.frequency);
             await db.update(reportSchedules)
                 .set({ 
                     lastRunAt: now,
                     nextRunAt: nextRun,
                     updatedAt: now
                 })
                 .where(eq(reportSchedules.id, schedule.id));

         } catch (e) {
             console.error(`❌ Failed to process report ${schedule.reportType} for tenant ${schedule.tenantId}:`, e);
         }
     }
  },
  
  /**
   * Generate PDF and Send Email
   */
  async generateAndSend(schedule: typeof reportSchedules.$inferSelect) {
      console.log(`Generating ${schedule.reportType} report for tenant ${schedule.tenantId}...`);
      
      let pdfBuffer: Buffer;
      let subject = `zcrAI Scheduled Report: ${schedule.reportType.toUpperCase()}`;
      
      // Select Report Type
      switch (schedule.reportType) {
          case 'iso27001':
              pdfBuffer = await ReportService.generateISO27001ReportPDF(schedule.tenantId);
              subject = `ISO 27001 Compliance Report - ${new Date().toLocaleDateString()}`;
              break;
          case 'nist':
              pdfBuffer = await ReportService.generateNISTReportPDF(schedule.tenantId);
               subject = `NIST CSF Compliance Report - ${new Date().toLocaleDateString()}`;
              break;
          case 'pdpa':
              pdfBuffer = await ReportService.generateThaiPDPAReportPDF(schedule.tenantId);
               subject = `Thai PDPA Compliance Report - ${new Date().toLocaleDateString()}`;
              break;
          case 'dashboard':
          default:
              pdfBuffer = await ReportService.generateDashboardPDF(schedule.tenantId);
               subject = `Security Dashboard Summary - ${new Date().toLocaleDateString()}`;
              break;
      }
      
      // Send to all recipients
      const recipients = schedule.recipients as string[]; // Cast JSONB array
      for (const email of recipients) {
          await EmailService.sendEmail({
              to: email,
              subject: subject,
              html: `
                <h3>Your Scheduled Report is Ready</h3>
                <p>Please find attached the <strong>${schedule.reportType.toUpperCase()}</strong> report generated automatically by zcrAI.</p>
                <p>Frequency: ${schedule.frequency}</p>
                <br/>
                <p>Best regards,<br/>The zcrAI Team</p>
              `,
              attachments: [
                  {
                      filename: `${schedule.reportType}_report_${new Date().toISOString().split('T')[0]}.pdf`,
                      content: pdfBuffer
                  }
              ]
          });
      }
  },

  /**
   * Helper: Calculate next run date
   */
  calculateNextRun(frequency: string): Date {
      const date = new Date();
      // Reset seconds/ms for clean scheduling
      date.setSeconds(0);
      date.setMilliseconds(0);
      
      if (frequency === 'daily') {
          date.setDate(date.getDate() + 1);
          date.setHours(9, 0, 0, 0); // 9 AM Next Day
      } else if (frequency === 'weekly') {
          date.setDate(date.getDate() + 7);
          date.setHours(9, 0, 0, 0); // 9 AM Next Week
      } else if (frequency === 'monthly') {
          date.setMonth(date.getMonth() + 1);
          date.setHours(9, 0, 0, 0); // 9 AM Next Month
      } else {
          // Default daily if unknown
           date.setDate(date.getDate() + 1);
      }
      
      return date;
  }
};
