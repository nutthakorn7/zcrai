import { db } from '../../infra/db';
import { cases } from '../../infra/db/schema';
import { eq, and, gte, lte, sql, count } from 'drizzle-orm';

export class AnalyticsService {
  /**
   * Get main dashboard metrics
   * @param tenantId Tenant ID
   * @param startDate Start date filter
   * @param endDate End date filter
   */
  async getDashboardMetrics(tenantId: string, startDate?: string, endDate?: string) {
    const start = startDate ? new Date(startDate) : new Date(new Date().setDate(new Date().getDate() - 30)); // Default 30 days
    const end = endDate ? new Date(endDate) : new Date();

    const filters = and(
      eq(cases.tenantId, tenantId),
      gte(cases.createdAt, start),
      lte(cases.createdAt, end)
    );

    // 1. Volume by Status
    const statusCounts = await db
      .select({
        status: cases.status,
        count: count(),
      })
      .from(cases)
      .where(filters)
      .groupBy(cases.status);

    // 2. Volume by Severity
    const severityCounts = await db
      .select({
        severity: cases.severity,
        count: count(),
      })
      .from(cases)
      .where(filters)
      .groupBy(cases.severity);

    // 3. (Removed Volume by Type as column does not exist)

    // 4. Mean Time to Resolve (MTTR)
    const resolvedCases = await db
      .select({
        created: cases.createdAt,
        resolved: cases.resolvedAt,
      })
      .from(cases)
      .where(and(filters, eq(cases.status, 'resolved'))); // or closed

    let totalDurationMinutes = 0;
    let resolvedCount = 0;

    resolvedCases.forEach(c => {
      if (c.created && c.resolved) {
        const diffMs = c.resolved.getTime() - c.created.getTime();
        totalDurationMinutes += diffMs / (1000 * 60);
        resolvedCount++;
      }
    });

    const mttrHours = resolvedCount > 0 ? (totalDurationMinutes / resolvedCount / 60).toFixed(2) : 0;

    // 5. Volume Over Time (Daily)
    const volumeOverTime = await db
        .select({
            date: sql<string>`DATE(${cases.createdAt})`, // Postgres specific
            count: count()
        })
        .from(cases)
        .where(filters)
        .groupBy(sql`DATE(${cases.createdAt})`)
        .orderBy(sql`DATE(${cases.createdAt})`);

    return {
      period: { start, end },
      totals: {
        cases: statusCounts.reduce((acc, curr) => acc + curr.count, 0),
        resolved: resolvedCount,
        mttrHours: Number(mttrHours)
      },
      distribution: {
        status: statusCounts,
        severity: severityCounts,
        type: [] // Empty for now
      },
      trends: {
        volume: volumeOverTime
      }
    };
  }
}

export const analyticsService = new AnalyticsService();
