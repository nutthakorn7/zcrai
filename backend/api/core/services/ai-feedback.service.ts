import { db } from '../../infra/db';
import { aiFeedback, alerts } from '../../infra/db/schema';
import { eq, sql, and } from 'drizzle-orm';

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
        const TIME_SAVED_PER_TRIAGE_MINS = 15;
        const TIME_SAVED_PER_BLOCK_MINS = 30;
        const ANALYST_HOURLY_RATE = 50;

        const totalMinutesSaved = (totalTriageCount * TIME_SAVED_PER_TRIAGE_MINS) + 
                                  (totalAutoBlocks * TIME_SAVED_PER_BLOCK_MINS);
        
        const totalHoursSaved = totalMinutesSaved / 60;
        const costSavings = totalHoursSaved * ANALYST_HOURLY_RATE;

        return {
            totalTriageCount,
            totalAutoBlocks,
            totalHoursSaved: Math.round(totalHoursSaved * 10) / 10,
            costSavings: Math.round(costSavings),
            accuracyRate: Math.round(accuracyRate),
            feedbackCount: totalFeedback
        };
    }
}
