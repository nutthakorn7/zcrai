/**
 * Alert Feedback Service
 * Tracks analyst feedback to reduce false positives through machine learning
 */

import { db } from '../../infra/db';
import { alerts } from '../../infra/db/schema';
import { eq, and, sql, gte, desc } from 'drizzle-orm';

interface FeedbackStats {
  totalAlerts: number;
  confirmed: number;
  falsePositives: number;
  fpRate: number;
  patterns: FPPattern[];
}

interface FPPattern {
  rule: string;
  source: string;
  severity: string;
  fpCount: number;
  totalCount: number;
  fpRate: number;
}

interface FeedbackInput {
  alertId: string;
  feedback: 'confirmed' | 'false_positive';
  reason?: string;
}

export const AlertFeedbackService = {
  /**
   * Record analyst feedback on an alert
   */
  async recordFeedback(tenantId: string, userId: string, input: FeedbackInput) {
    // Update alert status based on feedback
    const newStatus = input.feedback === 'false_positive' ? 'dismissed' : 'promoted';
    
    await db.update(alerts)
      .set({
        status: newStatus,
        // Store feedback in rawData jsonb field
        rawData: sql`COALESCE(raw_data, '{}'::jsonb) || 
          jsonb_build_object(
            'feedback', ${input.feedback},
            'feedbackReason', ${input.reason || null},
            'feedbackBy', ${userId},
            'feedbackAt', ${new Date().toISOString()}
          )`,
        updatedAt: new Date()
      })
      .where(and(
        eq(alerts.id, input.alertId),
        eq(alerts.tenantId, tenantId)
      ));

    return { success: true };
  },

  /**
   * Get false positive statistics for tuning
   */
  async getFPStats(tenantId: string, days: number = 30): Promise<FeedbackStats> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Total and FP counts - using status field for simplicity
    const [stats] = await db.execute(sql`
      SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE raw_data->>'feedback' = 'confirmed') as confirmed,
        COUNT(*) FILTER (WHERE raw_data->>'feedback' = 'false_positive') as false_positives
      FROM ${alerts}
      WHERE ${alerts.tenantId} = ${tenantId}
        AND ${alerts.createdAt} >= ${startDate}
        AND raw_data->>'feedback' IS NOT NULL
    `);

    const total = Number((stats as any)?.total || 0);
    const confirmed = Number((stats as any)?.confirmed || 0);
    const falsePositives = Number((stats as any)?.false_positives || 0);

    // Pattern detection - group by source/severity (no rule_name column)
    const patterns = await db.execute(sql`
      SELECT 
        COALESCE(source, 'Unknown') as source,
        severity,
        COUNT(*) FILTER (WHERE raw_data->>'feedback' = 'false_positive') as fp_count,
        COUNT(*) as total_count
      FROM ${alerts}
      WHERE ${alerts.tenantId} = ${tenantId}
        AND ${alerts.createdAt} >= ${startDate}
        AND raw_data->>'feedback' IS NOT NULL
      GROUP BY source, severity
      HAVING COUNT(*) >= 3
      ORDER BY COUNT(*) FILTER (WHERE raw_data->>'feedback' = 'false_positive')::float / COUNT(*) DESC
      LIMIT 10
    `);

    const fpPatterns: FPPattern[] = (patterns as any[]).map(p => ({
      rule: p.source, // Use source as rule since rule_name doesn't exist
      source: p.source,
      severity: p.severity,
      fpCount: Number(p.fp_count),
      totalCount: Number(p.total_count),
      fpRate: Number(p.total_count) > 0 ? Number(p.fp_count) / Number(p.total_count) : 0
    }));

    return {
      totalAlerts: total,
      confirmed,
      falsePositives,
      fpRate: total > 0 ? falsePositives / total : 0,
      patterns: fpPatterns
    };
  },

  /**
   * Get suggested tuning recommendations
   */
  async getTuningRecommendations(tenantId: string) {
    const stats = await this.getFPStats(tenantId, 30);
    
    const recommendations: string[] = [];

    // High FP rate overall
    if (stats.fpRate > 0.3) {
      recommendations.push(`High false-positive rate (${(stats.fpRate * 100).toFixed(0)}%). Consider adjusting detection thresholds.`);
    }

    // Specific pattern recommendations
    stats.patterns.forEach(p => {
      if (p.fpRate > 0.5 && p.totalCount >= 5) {
        recommendations.push(`Rule "${p.rule}" has ${(p.fpRate * 100).toFixed(0)}% FP rate from ${p.source}. Consider tuning or whitelisting.`);
      }
    });

    // Low sample size
    if (stats.totalAlerts < 10) {
      recommendations.push('Not enough feedback data for reliable recommendations. Encourage analysts to provide feedback.');
    }

    return {
      stats,
      recommendations,
      topFPPatterns: stats.patterns.slice(0, 5)
    };
  }
};
