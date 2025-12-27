import { db } from '../../infra/db';
import { alerts, users } from '../../infra/db/schema';
import { eq, and, desc, sql } from 'drizzle-orm';

export interface SubmitFeedbackParams {
  alertId: string;
  userId: string;
  feedback: 'correct' | 'incorrect';
  reason?: string;
  shouldReopen?: boolean;
}

export class FeedbackService {
  /**
   * Submit feedback for an alert
   */
  static async submitFeedback(params: SubmitFeedbackParams) {
    const { alertId, userId, feedback, reason, shouldReopen } = params;

    console.log(`[FeedbackService] Submitting feedback for alert ${alertId} by user ${userId}: ${feedback}`);

    // updates object
    const updateData: any = {
      userFeedback: feedback,
      feedbackReason: reason,
      feedbackBy: userId,
      feedbackAt: new Date(),
    };

    // If incorrect and request to reopen, update status to 'investigating'
    if (feedback === 'incorrect' && shouldReopen) {
      updateData.status = 'investigating';
      updateData.aiTriageStatus = 'pending'; // Reset triage status to allow re-evaluation if needed
    }

    // Update Alert
    const [updatedAlert] = await db.update(alerts)
      .set(updateData)
      .where(eq(alerts.id, alertId))
      .returning();

    return updatedAlert;
  }

  /**
   * Get feedback accuracy metrics
   */
  static async getAccuracyMetrics(tenantId: string) {
    // Total alerts with feedback
    const feedbackAlerts = await db.select({
      id: alerts.id,
      userFeedback: alerts.userFeedback,
    })
    .from(alerts)
    .where(
      and(
        eq(alerts.tenantId, tenantId),
        sql`${alerts.userFeedback} IS NOT NULL`
      )
    );

    const totalReviewed = feedbackAlerts.length;
    if (totalReviewed === 0) {
      return {
        accuracy: 0,
        totalReviewed: 0,
        correctCount: 0,
        incorrectCount: 0
      };
    }

    const correctCount = feedbackAlerts.filter(a => a.userFeedback === 'correct').length;
    const incorrectCount = feedbackAlerts.filter(a => a.userFeedback === 'incorrect').length;
    
    // Accuracy = (Correct / Total Reviewed) * 100
    const accuracy = (correctCount / totalReviewed) * 100;

    return {
      accuracy: Number(accuracy.toFixed(2)),
      totalReviewed,
      correctCount,
      incorrectCount
    };
  }
}
