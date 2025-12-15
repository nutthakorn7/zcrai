import { describe, it, expect, spyOn, mock, beforeAll } from 'bun:test';
import { ReportSchedulerService } from '../core/services/report-scheduler.service';
import { EmailService } from '../core/services/email.service';
import { ReportService } from '../core/services/report.service';
import { db } from '../infra/db';
import { reportSchedules, tenants } from '../infra/db/schema';
import { eq } from 'drizzle-orm';

describe('Report Scheduler', () => {
    
    // Mocks
    const sendEmailSpy = spyOn(EmailService, 'sendEmail').mockResolvedValue(true);
    spyOn(ReportService, 'generateDashboardPDF').mockResolvedValue(Buffer.from('PDF'));
    
    let scheduleId: string;
    let tenantId: string;

    beforeAll(async () => {
        // Fetch valid tenant
        const [tenant] = await db.select().from(tenants).limit(1);
        if (!tenant) throw new Error('No tenant found for testing');
        tenantId = tenant.id;
    });

    it('should create a report schedule', async () => {
        const schedule = await ReportSchedulerService.createSchedule({
            tenantId,
            reportType: 'dashboard',
            frequency: 'daily',
            recipients: ['admin@example.com'],
            isEnabled: true,
            nextRunAt: new Date(), // Set to now to trigger immediately in next test
        } as any);
        
        expect(schedule).toBeTruthy();
        expect(schedule.id).toBeDefined();
        scheduleId = schedule.id;
    });

    it('should process due reports and send email', async () => {
        // Manually trigger process
        // For testing, we might need to "force" the nextRunAt to be in the past if createSchedule set it to future.
        // But in previous test we tried to set nextRunAt passed in. 
        // Note: `createSchedule` in service OVERWRITES `nextRunAt` with calculated value.
        // So we need to manually update DB to set `nextRunAt` to past to test processing.
        
        await db.update(reportSchedules)
            .set({ nextRunAt: new Date(Date.now() - 10000) }) // 10s ago
            .where(eq(reportSchedules.id, scheduleId));
            
        await ReportSchedulerService.processDueReports();
        
        expect(sendEmailSpy).toHaveBeenCalled();
        
        // Verify Next Run Updated
        const [updated] = await db.select().from(reportSchedules).where(eq(reportSchedules.id, scheduleId));
        expect(updated.lastRunAt).toBeDefined();
        expect(new Date(updated.nextRunAt).getTime()).toBeGreaterThan(Date.now());
    });
});
