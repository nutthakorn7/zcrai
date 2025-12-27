import { db } from '../../../infra/db';
import { tenants, users } from '../../../infra/db/schema';
import { eq, and } from 'drizzle-orm';
import { ReportService } from '../../services/report.service';
import { EmailService } from '../../services/email.service';

export const digestJob = async () => {
    console.log('[DigestJob] 🛡️ Starting Weekly Security Digest generation...');

    // 1. Fetch Active Tenants
    const activeTenants = await db.select().from(tenants).where(eq(tenants.status, 'active'));

    for (const tenant of activeTenants) {
        console.log(`[DigestJob] Processing tenant: ${tenant.name} (${tenant.id})`);
        
        try {
            // 2. Generate Stats
            const stats = await ReportService.getWeeklyStats(tenant.id);
            
            // 3. Find Admins
            const admins = await db.select()
                .from(users)
                .where(
                    and(
                        eq(users.tenantId, tenant.id),
                        eq(users.role, 'admin'),
                        eq(users.status, 'active')
                    )
                );

            if (admins.length === 0) {
                console.log(`[DigestJob] No admins found for tenant ${tenant.id}. Skipping email.`);
                continue;
            }

            // 4. Send Emails
            for (const admin of admins) {
                console.log(`[DigestJob] Sending digest to ${admin.email}...`);
                await EmailService.sendSmartDigest(admin.email, stats);
            }

        } catch (error) {
            console.error(`[DigestJob] ❌ Failed to process tenant ${tenant.id}:`, error);
        }
    }

    console.log('[DigestJob] ✅ Weekly Digest completed.');
};
