import { db } from '../../infra/db';
import { detectionRules, alerts, cases } from '../../infra/db/schema';
import { eq, and, lte } from 'drizzle-orm';
import { query } from '../../infra/clickhouse/client';
import { AlertService } from './alert.service';

export const DetectionService = {
  // Run all active rules that are due
  async runAllDueRules() {
    console.log('🔍 Running Detection Rules...');
    
    // 1. Fetch active rules
    const activeRules = await db
      .select()
      .from(detectionRules)
      .where(eq(detectionRules.isEnabled, true));

    for (const rule of activeRules) {
        try {
            await this.runRule(rule);
        } catch (e) {
            console.error(`❌ Failed to run rule ${rule.name}:`, e);
        }
    }
  },

  // Run a single rule
  async runRule(rule: typeof detectionRules.$inferSelect) {
    const now = new Date();
    // Default lookback is last run, else 1 hour ago (for safety)
    const lastRun = rule.lastRunAt || new Date(now.getTime() - 60 * 60 * 1000);
    
    // Format for ClickHouse
    // Note: ClickHouse DateTime64 is precise, we format appropriately
    const lastRunStr = lastRun.toISOString().replace('T', ' ').split('.')[0];
    
    // Construct Query: Rule Query AND timestamp > lastRun
    const finalQuery = `
        SELECT *
        FROM security_events
        WHERE tenant_id = {tenantId:String}
          AND timestamp > {lastRun:DateTime64}
          AND (${rule.query})
        LIMIT 100
    `;

    try {
        const hits = await query<any>(finalQuery, {
            tenantId: rule.tenantId,
            lastRun: lastRunStr
        });

        if (hits.length > 0) {
            console.log(`🚨 Rule "${rule.name}" triggered! Found ${hits.length} events.`);
            
            // Create Alert for each hit (or grouped? For now individual for simplicity, can group later)
            // Let's create one alert per hit to be granular, utilizing AlertService dedupe
            for (const hit of hits) {
                const alert = await AlertService.create({
                    tenantId: rule.tenantId,
                    source: 'detection_engine',
                    severity: rule.severity,
                    title: `[Detection] ${rule.name}`,
                    description: `Rule "${rule.name}" triggered.\n\nEvent: ${hit.title || 'Unknown Event'}\nDescription: ${hit.description || ''}\nTimestamp: ${hit.timestamp}`,
                    rawData: hit,
                    observables: [] // Todo: extract from hit
                });

                // Auto-Action: Create Case
                const actions = rule.actions as any;
                if (actions?.auto_case && alert) {
                    // Create a case
                     const [newCase] = await db.insert(cases).values({
                        tenantId: rule.tenantId,
                        title: actions.case_title_template || `[Auto] Investigation: ${rule.name}`,
                        description: `Automatically created by detection rule "${rule.name}"\n\nAlert ID: ${alert.id}`,
                        severity: actions.severity_override || rule.severity,
                        status: 'open',
                        priority: 'P2',
                        tags: ['auto-generated', 'detection-rule'],
                    }).returning();

                    // Link alert to case
                    await AlertService.linkToCase(alert.id, rule.tenantId, newCase.id);
                    console.log(`✅ Auto-created case ${newCase.id} for alert ${alert.id}`);
                }
            }
        }

        // Update Last Run
        await db.update(detectionRules)
            .set({ lastRunAt: now })
            .where(eq(detectionRules.id, rule.id));

    } catch (e: any) {
        // If SQL error, log it. Might disable rule if constant failure?
        throw new Error(`ClickHouse Query Failed: ${e.message}`);
    }
  },
  
  // CRUD
  async createRule(data: typeof detectionRules.$inferInsert) {
      const [rule] = await db.insert(detectionRules).values(data).returning();
      return rule;
  },
  
  async getRules(tenantId: string) {
      return await db.select().from(detectionRules).where(eq(detectionRules.tenantId, tenantId));
  }
};
