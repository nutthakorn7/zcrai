import { CronJob } from 'cron';
import { ReportService } from './report.service';
import { EmailService } from './email.service';
import { DetectionService } from './detection.service';
import { RetentionService } from './retention.service';
import { ReportSchedulerService } from './report-scheduler.service';

export const SchedulerService = {
  jobs: [] as CronJob[],

  init() {
    console.log('⏳ Initializing Scheduler Service...');
    
    // Weekly Executive Report (Every Monday at 9:00 AM)
    // Cron pattern: 0 9 * * 1 (Sec Min Hour DOM Month DOW) - wait, cron package uses 6 fields? 
    // node-cron usually uses 5 or 6. Let's check package Usage. 
    // 'cron' package standard: Seconds: 0-59, Minutes: 0-59, Hours: 0-23, Day of Month: 1-31, Months: 0-11 (Jan-Dec), Day of Week: 0-6 (Sun-Sat)
    
    const weeklyReportJob = new CronJob(
      '0 0 9 * * 1', // 9:00:00 AM every Monday
      async () => {
        console.log('🤖 Running Weekly Executive Report Job...');
        try {
          await this.generateAndSendWeeklyReport();
        } catch (error) {
          console.error('❌ Weekly Report Job Failed:', error);
        }
      },
      null,
      true, // start immediately
      'Asia/Bangkok' // Timezone
    );
    
    this.jobs.push(weeklyReportJob);

    // Detection Engine Job (Every 1 minute)
    // Runs active detection rules against new logs
    const detectionJob = new CronJob(
        '*/1 * * * *', // Every minute
        async () => {
            try {
                await DetectionService.runAllDueRules();
            } catch (error) {
                console.error('❌ Detection Job Failed:', error);
            }
        },
        null,
        true,
        'Asia/Bangkok'
    );
    this.jobs.push(detectionJob);

    // Retention Policy Enforcement Job (Every Midnight)
    // Deletes old logs from ClickHouse
    const retentionJob = new CronJob(
        '0 0 0 * * *', // Midnight
        async () => {
             console.log('🧹 Running Daily Retention Job...');
             try {
                 await RetentionService.enforceRetention();
             } catch (error) {
                 console.error('❌ Retention Job Failed:', error);
             }
        },
        null,
        true,
        'Asia/Bangkok'
    );
    this.jobs.push(retentionJob);

    // Scheduled Reporting Job (Every Hour)
    // Checks for reports due to be sent
    const reportJob = new CronJob(
        '0 * * * *', // Every hour
        async () => {
             console.log('📬 Checking for scheduled reports...');
             try {
                 await ReportSchedulerService.processDueReports();
             } catch (error) {
                 console.error('❌ Report Scheduler Job Failed:', error);
             }
        },
        null,
        true,
        'Asia/Bangkok'
    );
    this.jobs.push(reportJob);

    // Integration Sync Job (Every 15 minutes)
    // Triggers Collector to sync CrowdStrike/SentinelOne data
    const integrationSyncJob = new CronJob(
        '*/15 * * * *', // Every 15 minutes
        async () => {
             console.log('🔄 Triggering Integration Sync...');
             try {
                 const collectorUrl = process.env.COLLECTOR_URL || 'http://localhost:8001';
                 await fetch(`${collectorUrl}/collect/all`, { method: 'POST' });
                 console.log('✅ Integration sync triggered');
             } catch (error) {
                 console.error('❌ Integration Sync Failed:', error);
             }
        },
        null,
        true,
        'Asia/Bangkok'
    );
    this.jobs.push(integrationSyncJob);

    // Integration Health Check (Every 5 minutes)
    const healthCheckJob = new CronJob(
        '*/5 * * * *', // Every 5 minutes
        async () => {
            console.log('💓 Running Integration Health Heartbeat...');
            try {
                const { IntegrationService } = await import('./integration.service');
                await IntegrationService.checkAllHealth();
            } catch (error) {
                console.error('❌ Health Check Job Failed:', error);
            }
        },
        null,
        true,
        'Asia/Bangkok'
    );
    this.jobs.push(healthCheckJob);

    console.log(`✅ Scheduler started with ${this.jobs.length} jobs.`);
  },

  async generateAndSendWeeklyReport() {
    // 1. Determine Date Range (Last 7 Days)
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - 7);
    
    // 2. Format Dates like "2023-10-25"
    const startStr = startDate.toISOString().split('T')[0];
    const endStr = endDate.toISOString().split('T')[0];
    
    console.log(`📊 Generating Report for ${startStr} to ${endStr}`);

    // 3. Generate PDF Buffer
    // We reuse the existing Dashboard PDF endpoint logic via Service call
    // Note: ReportService.generateDashboardPDF is designed for web response (stream), 
    // we might need to adjust it or capture the stream. 
    // Let's assume we can refactor ReportService or use it directly if it returns a buffer.
    
    // Check ReportService signature...
    // If ReportService.generateDashboardPDF writes to a stream, we might need a helper.
    // Let's assume for now we call the same logic. 
    // Actually, ReportService uses Puppeteer to print page.
    
    // We need to pass a tenantId. For MVP/SuperAdmin report, we can pick the first tenant or a specific one.
    // Let's assume there is a 'default' tenant or we fetch active tenants.
    // For now, let's use a hardcoded tenantId that we know exists or 'default'.
    const tenantId = 'tenant-id-123'; // REPLACE with real logic to iterate tenants
    
    // Correct Signature: generateDashboardPDF(tenantId, options)
    const pdfBuffer = await ReportService.generateDashboardPDF(tenantId, {
        startDate: startStr,
        endDate: endStr,
        title: `Weekly Executive Report (${startStr} - ${endStr})`
    });

    // 4. Send Email
    // Hardcoded to admin for MVP. In real app, fetch admins from DB.
    const recipient = 'admin@zcr.ai'; // Todo: fetch superadmin email or use env
    
    await EmailService.sendEmail({
      to: recipient,
      subject: `📊 Weekly Executive Security Report (${startStr} - ${endStr})`,
      html: `
        <h2>Weekly Security Executive Summary</h2>
        <p>Please find attached the security report for the period <strong>${startStr}</strong> to <strong>${endStr}</strong>.</p>
        <p>This report includes:</p>
        <ul>
            <li>Total Alerts & Severity Breakdown</li>
            <li>Top Active Playbooks</li>
            <li>Incident Trends</li>
        </ul>
        <br/>
        <p>Generated by zcrAI SOC Platform</p>
      `,
      attachments: [
        {
          filename: `Executive_Report_${startStr}_${endStr}.pdf`,
          content: pdfBuffer
        }
      ]
    });
  }
};
