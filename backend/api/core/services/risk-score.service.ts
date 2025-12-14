/**
 * Risk Score Service
 * Provides predictive risk analysis based on historical alert data
 */

import { db } from '../../infra/db';
import { alerts } from '../../infra/db/schema';
import { sql, eq, and, gte, desc } from 'drizzle-orm';

interface RiskScore {
  overall: number; // 0-100
  level: 'low' | 'medium' | 'high' | 'critical';
  components: {
    alertVelocity: number;     // Rate of change
    severityScore: number;     // Weighted severity
    fpRate: number;           // False positive impact
    trendScore: number;       // Trend direction
  };
  trend: 'increasing' | 'stable' | 'decreasing';
}

interface TrendPrediction {
  historical: Array<{ date: string; count: number }>;
  predicted: Array<{ date: string; count: number; confidence: number }>;
  averageDaily: number;
  predictedChange: number; // % change in next 7 days
}

export const RiskScoreService = {
  /**
   * Calculate overall risk score for tenant
   */
  async calculateRiskScore(tenantId: string): Promise<RiskScore> {
    const now = new Date();
    const sevenDaysAgo = new Date(now);
    sevenDaysAgo.setDate(now.getDate() - 7);
    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(now.getDate() - 30);

    // Get alert counts by severity for last 7 days
    const [recentStats] = await db.execute(sql`
      SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE severity = 'critical') as critical,
        COUNT(*) FILTER (WHERE severity = 'high') as high,
        COUNT(*) FILTER (WHERE severity = 'medium') as medium,
        COUNT(*) FILTER (WHERE severity = 'low') as low,
        COUNT(*) FILTER (WHERE status = 'dismissed') as dismissed
      FROM ${alerts}
      WHERE tenant_id = ${tenantId}
        AND created_at >= ${sevenDaysAgo}
    `);

    // Get alert counts for previous 7 days (for velocity)
    const [previousStats] = await db.execute(sql`
      SELECT COUNT(*) as total
      FROM ${alerts}
      WHERE tenant_id = ${tenantId}
        AND created_at >= ${thirtyDaysAgo}
        AND created_at < ${sevenDaysAgo}
    `);

    const stats = recentStats as any;
    const prevStats = previousStats as any;

    const total = Number(stats?.total || 0);
    const critical = Number(stats?.critical || 0);
    const high = Number(stats?.high || 0);
    const medium = Number(stats?.medium || 0);
    const dismissed = Number(stats?.dismissed || 0);
    const prevTotal = Number(prevStats?.total || 0);

    // 1. Alert Velocity (rate of change)
    const velocityChange = prevTotal > 0 ? ((total - prevTotal) / prevTotal) * 100 : 0;
    const alertVelocity = Math.min(100, Math.max(0, 50 + velocityChange));

    // 2. Severity Score (weighted)
    const severityWeights = { critical: 10, high: 5, medium: 2, low: 1 };
    const maxSeverityScore = total * severityWeights.critical;
    const actualScore = critical * severityWeights.critical +
                       high * severityWeights.high +
                       medium * severityWeights.medium +
                       (total - critical - high - medium) * severityWeights.low;
    const severityScore = total > 0 ? (actualScore / maxSeverityScore) * 100 : 0;

    // 3. FP Rate Impact (lower is better)
    const fpRate = total > 0 ? (dismissed / total) * 100 : 0;
    const fpImpact = 100 - fpRate; // Invert: high FP = lower risk score contribution

    // 4. Trend Score
    const trendDirection: 'increasing' | 'stable' | 'decreasing' = 
      velocityChange > 20 ? 'increasing' :
      velocityChange < -20 ? 'decreasing' : 'stable';
    const trendScore = trendDirection === 'increasing' ? 80 :
                       trendDirection === 'decreasing' ? 20 : 50;

    // Calculate overall risk score (weighted average)
    const overall = Math.round(
      alertVelocity * 0.25 +
      severityScore * 0.35 +
      fpImpact * 0.15 +
      trendScore * 0.25
    );

    // Determine risk level
    const level: 'low' | 'medium' | 'high' | 'critical' =
      overall >= 75 ? 'critical' :
      overall >= 50 ? 'high' :
      overall >= 25 ? 'medium' : 'low';

    return {
      overall,
      level,
      components: {
        alertVelocity: Math.round(alertVelocity),
        severityScore: Math.round(severityScore),
        fpRate: Math.round(fpRate),
        trendScore: Math.round(trendScore)
      },
      trend: trendDirection
    };
  },

  /**
   * Get trend prediction for next 7 days
   */
  async getTrendPrediction(tenantId: string): Promise<TrendPrediction> {
    const now = new Date();
    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(now.getDate() - 30);

    // Get daily counts for last 30 days
    const dailyCounts = await db.execute(sql`
      SELECT 
        to_char(created_at, 'YYYY-MM-DD') as date,
        COUNT(*) as count
      FROM ${alerts}
      WHERE tenant_id = ${tenantId}
        AND created_at >= ${thirtyDaysAgo}
      GROUP BY date
      ORDER BY date ASC
    `);

    const historical = (dailyCounts as any[]).map(row => ({
      date: row.date,
      count: Number(row.count)
    }));

    // Calculate average and trend
    const counts = historical.map(h => h.count);
    const avg = counts.length > 0 ? counts.reduce((a, b) => a + b, 0) / counts.length : 0;

    // Simple linear regression for trend
    const n = counts.length;
    let slope = 0;
    if (n >= 7) {
      const xMean = (n - 1) / 2;
      const yMean = avg;
      let num = 0, den = 0;
      for (let i = 0; i < n; i++) {
        num += (i - xMean) * (counts[i] - yMean);
        den += (i - xMean) ** 2;
      }
      slope = den !== 0 ? num / den : 0;
    }

    // Predict next 7 days
    const predicted: Array<{ date: string; count: number; confidence: number }> = [];
    for (let i = 1; i <= 7; i++) {
      const futureDate = new Date(now);
      futureDate.setDate(now.getDate() + i);
      const dateStr = futureDate.toISOString().split('T')[0];
      
      // Prediction based on trend
      const predictedCount = Math.max(0, Math.round(avg + slope * (n + i)));
      // Confidence decreases with distance
      const confidence = Math.max(0.5, 1 - (i * 0.07));

      predicted.push({
        date: dateStr,
        count: predictedCount,
        confidence: Number(confidence.toFixed(2))
      });
    }

    // Calculate predicted change
    const lastWeekAvg = counts.slice(-7).reduce((a, b) => a + b, 0) / Math.min(7, counts.length);
    const nextWeekAvg = predicted.reduce((a, p) => a + p.count, 0) / 7;
    const predictedChange = lastWeekAvg > 0 ? ((nextWeekAvg - lastWeekAvg) / lastWeekAvg) * 100 : 0;

    return {
      historical: historical.slice(-14), // Last 14 days
      predicted,
      averageDaily: Math.round(avg),
      predictedChange: Math.round(predictedChange)
    };
  },

  /**
   * Get risk alerts based on current risk assessment
   */
  async getRiskAlerts(tenantId: string) {
    const riskScore = await this.calculateRiskScore(tenantId);
    const prediction = await this.getTrendPrediction(tenantId);

    const alerts: string[] = [];

    // Risk level alerts
    if (riskScore.level === 'critical') {
      alerts.push('🚨 Critical risk level detected. Immediate attention required.');
    } else if (riskScore.level === 'high') {
      alerts.push('⚠️ High risk level. Review security posture.');
    }

    // Trend alerts
    if (riskScore.trend === 'increasing') {
      alerts.push(`📈 Alert volume increasing. ${Math.abs(riskScore.components.alertVelocity - 50).toFixed(0)}% rise detected.`);
    }

    // Prediction alerts
    if (prediction.predictedChange > 30) {
      alerts.push(`🔮 Predicted ${prediction.predictedChange}% increase in alerts next week.`);
    }

    // FP rate alerts
    if (riskScore.components.fpRate > 40) {
      alerts.push(`🎯 High false-positive rate (${riskScore.components.fpRate}%). Consider tuning detection rules.`);
    }

    return {
      riskScore,
      prediction,
      alerts
    };
  }
};
