import { db } from '../../infra/db';
import { cases, tenants } from '../../infra/db/schema';
import { eq, and, isNotNull, sql, avg, min, max } from 'drizzle-orm';

export class SLAService {
  /**
   * Get MTTA/MTTR metrics for a specific tenant or globally (null tenantId)
   */
  static async getSLUMetrics(tenantId?: string) {
    const conditions = [];
    if (tenantId) {
        conditions.push(eq(cases.tenantId, tenantId));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // MTTA: Time from createdAt to acknowledgedAt
    // MTTR: Time from createdAt to resolvedAt
    const stats = await db.select({
      count: sql<number>`count(*)`.mapWith(Number),
      avgMttaMinutes: sql<number>`AVG(EXTRACT(EPOCH FROM (acknowledged_at - created_at)) / 60)`.mapWith(Number),
      avgMttrMinutes: sql<number>`AVG(EXTRACT(EPOCH FROM (resolved_at - created_at)) / 60)`.mapWith(Number),
      minMtta: sql<number>`MIN(EXTRACT(EPOCH FROM (acknowledged_at - created_at)) / 60)`.mapWith(Number),
      maxMtta: sql<number>`MAX(EXTRACT(EPOCH FROM (acknowledged_at - created_at)) / 60)`.mapWith(Number),
    })
    .from(cases)
    .where(whereClause);

    return stats[0];
  }

  /**
   * Get SLA Trend (Daily) for charts
   */
  static async getSLATrend(tenantId: string, days: number = 30) {
    const rawSql = sql`
      SELECT 
        DATE(created_at) as date,
        AVG(EXTRACT(EPOCH FROM (acknowledged_at - created_at)) / 60) as avg_mtta,
        AVG(EXTRACT(EPOCH FROM (resolved_at - created_at)) / 60) as avg_mttr,
        COUNT(*) as case_count
      FROM cases
      WHERE tenant_id = ${tenantId}
      AND created_at >= NOW() - INTERVAL '${sql.raw(days.toString())} days'
      AND acknowledged_at IS NOT NULL
      GROUP BY DATE(created_at)
      ORDER BY date ASC
    `;

    return await db.execute(rawSql);
  }

  /**
   * MSSP Ranking: Ranking tenants by SLA performance
   */
  static async getMSSPPerformanceRanking() {
    const rawSql = sql`
      SELECT 
        t.name as tenant_name,
        t.id as tenant_id,
        AVG(EXTRACT(EPOCH FROM (c.acknowledged_at - c.created_at)) / 60) as avg_mtta,
        COUNT(c.id) as total_cases
      FROM tenants t
      LEFT JOIN cases c ON t.id = c.tenant_id
      WHERE c.acknowledged_at IS NOT NULL
      GROUP BY t.id, t.name
      ORDER BY avg_mtta ASC
    `;

    return await db.execute(rawSql);
  }
}
