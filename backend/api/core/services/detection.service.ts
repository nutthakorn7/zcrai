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
            const actions = rule.actions as any;
            const groupByFields = actions?.group_by as string[];

            if (groupByFields && groupByFields.length > 0) {
                // --- AGGREGATED MODE ---
                const groups: Record<string, any[]> = {};

                // Group hits
                for (const hit of hits) {
                    // Create a composite key based on group_by fields
                    // e.g. "192.168.1.1|john.doe"
                    const keyParts = groupByFields.map(field => {
                        // Support nested fields via dot notation (e.g. "user.name")
                        return field.split('.').reduce((obj, key) => obj?.[key], hit) || 'N/A';
                    });
                    const groupKey = keyParts.join('|');
                    
                    if (!groups[groupKey]) {
                        groups[groupKey] = [];
                    }
                    groups[groupKey].push(hit);
                }

                console.log(`📊 Aggregated into ${Object.keys(groups).length} incidents.`);

                // Create 1 Alert per Group
                for (const [groupKey, groupHits] of Object.entries(groups)) {
                    const count = groupHits.length;
                    const sample = groupHits[0];
                    
                    // Create summarized description
                    let aggregatedDesc = `Rule "${rule.name}" triggered ${count} times.\n`;
                    aggregatedDesc += `Aggregation Key: ${groupKey} (${groupByFields.join(', ')})\n\n`;
                    aggregatedDesc += `Last Event: ${sample.title || 'Unknown Event'}\n`;
                    aggregatedDesc += `Timestamp: ${sample.timestamp}\n`;
                    
                    const alert = await AlertService.create({
                        tenantId: rule.tenantId,
                        source: 'detection_engine',
                        severity: rule.severity,
                        title: `[Detection] ${rule.name} (x${count})`,
                        description: aggregatedDesc,
                        rawData: {
                            aggregate_count: count,
                            group_key: groupKey,
                            samples: groupHits // Store all hits or subset
                        },
                        observables: [] // Todo: extract from all hits?
                    });

                    // Auto-Action: Create Case (Per Group)
                    if (actions?.auto_case && alert) {
                        const [newCase] = await db.insert(cases).values({
                            tenantId: rule.tenantId,
                            title: actions.case_title_template || `[Auto] Investigation: ${rule.name} on ${groupKey}`,
                            description: `Automatically created by detection rule "${rule.name}"\n\nAlert ID: ${alert.id}\nEvent Count: ${count}`,
                            severity: actions.severity_override || rule.severity,
                            status: 'open',
                            priority: 'P2',
                            tags: ['auto-generated', 'detection-rule', 'aggregated'],
                        }).returning();

                        await AlertService.linkToCase(alert.id, rule.tenantId, newCase.id);
                        console.log(`✅ Auto-created aggregated case ${newCase.id} for alert ${alert.id}`);
                    }
                }

            } else {
                // --- INDIVIDUAL MODE (Legacy) ---
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
  },

  // Test Rule (Dry Run)
  async testRule(tenantId: string, queryStr: string, limit: number = 20) {
    const finalQuery = `
        SELECT *
        FROM security_events
        WHERE tenant_id = {tenantId:String}
          AND (${queryStr})
        ORDER BY timestamp DESC
        LIMIT {limit:UInt32}
    `;

    try {
        const hits = await query<any>(finalQuery, {
            tenantId,
            limit
        });
        return hits;
    } catch (e: any) {
        throw new Error(`ClickHouse Query Failed: ${e.message}`);
    }
  }
};
