import { db } from '../../infra/db';
import { aiFeedback, alerts } from '../../infra/db/schema';
import { eq, sql, and } from 'drizzle-orm';
import { AI_CONFIG } from '../../config/ai-config';

export class AIFeedbackService {
    
    /**
     * Submit feedback for an AI analysis
     */
    static async submitFeedback(tenantId: string, alertId: string, userId: string, feedback: { rating: number, comment?: string }) {
        // Verify alert exists and belongs to tenant
        const [alert] = await db
            .select()
            .from(alerts)
            .where(and(eq(alerts.id, alertId), eq(alerts.tenantId, tenantId)));
            
        if (!alert) throw new Error("Alert not found");

        const [entry] = await db.insert(aiFeedback).values({
            tenantId,
            alertId,
            userId,
            rating: feedback.rating,
            comment: feedback.comment
        }).returning();

        // 🔥 Continuous Learning: Re-embed with Corrected Verdict
        try {
            // Determine "New Truth"
            const aiVerdict = (alert.aiAnalysis as any)?.classification || 'UNKNOWN';
            let correctedVerdict = aiVerdict;
            
            // Rating 0 = Incorrect. If AI said True Positive, it's False Positive.
            if (feedback.rating === 0) {
                correctedVerdict = aiVerdict === 'TRUE_POSITIVE' ? 'FALSE_POSITIVE' : 'TRUE_POSITIVE'; // Flip it
            }

            // Append specific analyst guidance
            const contentToIndex = `Title: ${alert.title}. Description: ${alert.description}. Source: ${alert.source}. Verdict: ${correctedVerdict}. Reasoning: [Analyst Correction] ${feedback.comment || 'Marked as incorrect by analyst'}. (Originally predicted: ${aiVerdict})`;

            const { EmbeddingService } = await import('./embedding.service');
            await EmbeddingService.store(alertId, tenantId, contentToIndex);
            console.log(`[Continuous Learning] Re-embedded alert ${alertId} with corrected verdict: ${correctedVerdict}`);

        } catch (e) {
            console.warn(`[Continuous Learning] Failed to re-embed alert ${alertId}:`, e);
        }

        return entry;
    }

    /**
     * Calculate ROI Stats for the Tenant
     * Assumptions:
     * - 1 AI Triage (Verified/Blocked/Dismissed) saves ~15 mins
     * - Automated Block saves ~30 mins (included in Triage or separate? Let's say Auto-Block is +15 mins extra)
     * - Analyst Cost: $50/hour (Configurable later)
     */
    static async getROIStats(tenantId: string) {
        try {
            // 1. Count AI Actions
            const aiAlerts = await db
                .select({
                    aiAnalysis: alerts.aiAnalysis
                })
                .from(alerts)
                .where(eq(alerts.tenantId, tenantId));

            let totalTriageCount = 0;
            let totalAutoBlocks = 0;
            let truePositives = 0;
            let falsePositives = 0;

            aiAlerts.forEach(a => {
                const analysis = a.aiAnalysis as any;
                if (analysis) {
                    totalTriageCount++;
                    if (analysis.actionTaken?.type === 'BLOCK_IP') {
                        totalAutoBlocks++;
                    }
                    if (analysis.classification === 'TRUE_POSITIVE') truePositives++;
                    if (analysis.classification === 'FALSE_POSITIVE') falsePositives++;
                }
            });

            // 2. Fetch Feedback Stats
            const feedbackList = await db
                .select()
                .from(aiFeedback)
                .where(eq(aiFeedback.tenantId, tenantId));

            const helpfulCount = feedbackList.filter(f => f.rating === 1).length;
            const totalFeedback = feedbackList.length;
            const accuracyRate = totalFeedback > 0 ? (helpfulCount / totalFeedback) * 100 : 0;

            // 3. Calculate Savings
            const { ROI } = AI_CONFIG;
            
            const totalMinutesSaved = (totalTriageCount * ROI.TIME_SAVED_PER_TRIAGE_MINS) + 
                                      (totalAutoBlocks * ROI.TIME_SAVED_PER_BLOCK_MINS);
            
            const totalHoursSaved = totalMinutesSaved / 60;
            const costSavings = totalHoursSaved * ROI.ANALYST_HOURLY_RATE;

            return {
                totalTriageCount,
                totalAutoBlocks,
                totalHoursSaved: Math.round(totalHoursSaved * 10) / 10,
                costSavings: Math.round(costSavings),
                accuracyRate: Math.round(accuracyRate),
                feedbackCount: totalFeedback
            };
        } catch (error: any) {
            console.warn(`[AIFeedback] ROI Stats Fetch Failed (DB down?): ${error.message}`);
            return {
                totalTriageCount: 0,
                totalAutoBlocks: 0,
                totalHoursSaved: 0,
                costSavings: 0,
                accuracyRate: 0,
                feedbackCount: 0,
                error: "Database unreachable. ROI stats unavailable."
            };
        }
    }
}
