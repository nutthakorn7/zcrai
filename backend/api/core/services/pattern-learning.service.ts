import { db } from '../../infra/db';
import { alerts, learnedPatterns } from '../../infra/db/schema';
import { eq, and, sql, desc, gte } from 'drizzle-orm';

export class PatternLearningService {

    /**
     * Detect frequent False Positives and suggest patterns
     * Run this scheduled (daily/weekly)
     */
    static async detectFrequentFalsePositives(tenantId: string) {
        // Look back 30 days
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - 30);

        // 1. Find repetitive False Positives
        // Group by Title (Simple normalization)
        const candidates = await db.select({
            title: alerts.title,
            count: sql<number>`count(*)::int`
        })
        .from(alerts)
        .where(and(
            eq(alerts.tenantId, tenantId),
            gte(alerts.createdAt, startDate),
            // Check for explicit False Positive classification or dismissed status
            sql`jsonb_extract_path_text(${alerts.aiAnalysis}, 'classification') = 'FALSE_POSITIVE'`
        ))
        .groupBy(alerts.title)
        .having(sql`count(*) >= 5`) // Threshold: at least 5 times
        .orderBy(desc(sql`count(*)`));

        const newPatterns = [];

        for (const candidate of candidates) {
            // Check if pattern already exists
            const existing = await db.select().from(learnedPatterns).where(and(
                eq(learnedPatterns.tenantId, tenantId),
                eq(learnedPatterns.pattern, candidate.title)
            ));

            if (existing.length === 0) {
                // Propose new pattern
                const [pattern] = await db.insert(learnedPatterns).values({
                    tenantId,
                    pattern: candidate.title,
                    patternType: 'title',
                    confidence: 90, // Suggested confidence
                    status: 'pending', // Requires approval
                    source: 'auto_learning'
                }).returning();
                newPatterns.push(pattern);
            }
        }

        return {
            analyzed: candidates.length,
            newProposals: newPatterns.length,
            proposals: newPatterns
        };
    }

    /**
     * Get active patterns for Triage
     */
    static async getActivePatterns(tenantId: string) {
        return await db.select()
            .from(learnedPatterns)
            .where(and(
                eq(learnedPatterns.tenantId, tenantId),
                eq(learnedPatterns.status, 'active')
            ));
    }

    /**
     * Approve/Reject a pattern
     */
    static async updatePatternStatus(id: string, tenantId: string, status: 'active' | 'rejected') {
        const [updated] = await db.update(learnedPatterns)
            .set({ status, updatedAt: new Date() })
            .where(and(eq(learnedPatterns.id, id), eq(learnedPatterns.tenantId, tenantId)))
            .returning();
        return updated;
    }
}
