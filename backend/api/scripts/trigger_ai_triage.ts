
import { db } from '../infra/db';
import { alerts } from '../infra/db/schema';
import { eq, inArray } from 'drizzle-orm';
import { AITriageService } from '../core/services/ai-triage.service';

const pendingStatuses = ['enriching', 'pending'];

async function main() {
  console.log('🔄 Starting manual AI Triage trigger...');

  try {
    const pendingAlerts = await db.select().from(alerts)
      .where(inArray(alerts.aiTriageStatus, pendingStatuses))
      .limit(10); // Limit to avoid overload

    console.log(`📊 Found ${pendingAlerts.length} pending alerts.`);

    for (const alert of pendingAlerts) {
      console.log(`🤖 Analyzing Alert ${alert.id}: ${alert.title}...`);
      try {
        const result = await AITriageService.analyze(alert.id, alert);
        console.log(`✅ Result for ${alert.id}:`, result?.classification);
      } catch (error: any) {
        console.error(`❌ Failed to analyze ${alert.id}:`, error.message);
      }
    }

    console.log('🏁 Done.');
    process.exit(0);
  } catch (error) {
    console.error('❌ Script failed:', error);
    process.exit(1);
  }
}

main();
