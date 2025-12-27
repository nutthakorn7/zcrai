import { digestJob } from '../backend/api/core/scheduler/jobs/digest.job';
import { ReportService } from '../backend/api/core/services/report.service';

const verify = async () => {
    console.log('🧪 Verifying Reporting Features...');

    try {
        // 1. Check ROI Stats
        console.log('\n--- Checking ROI Stats API logic ---');
        // Mock a tenantId - in a real env we'd need a real one, but here we just want to ensure SQL doesn't crash
        // and returns a valid object structure.
        const stats = await ReportService.getWeeklyStats('test-tenant');
        console.log('✅ Stats Retrieved:', JSON.stringify(stats, null, 2));

        if (typeof stats.roiTimeSaved !== 'number') throw new Error('roiTimeSaved missing');

        // 2. Check Digest Job
        console.log('\n--- Triggering Digest Job (Dry Run) ---');
        await digestJob();
        console.log('✅ Digest Job completed without error.');

    } catch (error) {
        console.error('❌ Verification Failed:', error);
        process.exit(1);
    }
    process.exit(0);
};

verify();
