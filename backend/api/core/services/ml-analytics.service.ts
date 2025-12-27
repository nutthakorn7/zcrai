import { db } from '../../infra/db';
import { auditLogs, alerts } from '../../infra/db/schema';
import { sql, eq, and, gte, lte } from 'drizzle-orm';
import { query } from '../../infra/clickhouse/client';

export const MLAnalyticsService = {

  /**
   * Get Login Failure Baseline (Daily counts for last 30 days)
   * Uses audit_logs table filtering for 'login_failure' action
   */
  async getLoginFailureStats(tenantId: string) {
      const days = 30;
      const now = new Date();
      const thirtyDaysAgo = new Date(now);
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - days);

      // Group by day
      // Note: Postgres date_trunc
      const dailyCounts = await db.execute(sql`
        SELECT 
            to_char(created_at, 'YYYY-MM-DD') as day,
            COUNT(*) as count
        FROM ${auditLogs}
        WHERE ${auditLogs.tenantId} = ${tenantId}
            AND ${auditLogs.action} = 'user.login_failed'
            AND ${auditLogs.createdAt} >= ${thirtyDaysAgo.toISOString()}::timestamp
        GROUP BY 1
        ORDER BY 1 ASC
      `);

      // Fill in missing days with 0 (simplified for now, just map DB results)
      const history = dailyCounts.map((r: any) => parseInt(r.count));
      
      // Calculate average (baseline)
      const sum = history.reduce((a, b) => a + b, 0);
      const avg = history.length > 0 ? sum / history.length : 0;
      
      // Current day count (last item in sorted list if today exists, or query specifically)
      // For robustness, let's query "Today" separately or assume the last point is useful if up-to-date.
      // Better: Get count for *today* specifically.
      
      const todayStart = new Date();
      todayStart.setHours(0,0,0,0);
      
      const [todayResult] = await db.select({ count: sql<number>`count(*)` })
          .from(auditLogs)
          .where(and(
              eq(auditLogs.tenantId, tenantId),
              eq(auditLogs.action, 'user.login_failed'),
              gte(auditLogs.createdAt, todayStart)
          ));

      return {
          current: Number(todayResult.count),
          history: history,
          average: avg
      };
  },

  /**
   * Get Alert Volume Baseline
   */
  async getAlertVolumeStats(tenantId: string) {
      const days = 30;
      const now = new Date();
      const thirtyDaysAgo = new Date(now);
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - days);

      const dailyCounts = await db.execute(sql`
        SELECT 
            to_char(created_at, 'YYYY-MM-DD') as day,
            COUNT(*) as count
        FROM ${alerts}
        WHERE ${alerts.tenantId} = ${tenantId}
            AND ${alerts.createdAt} >= ${thirtyDaysAgo.toISOString()}::timestamp
        GROUP BY 1
        ORDER BY 1 ASC
      `);

      const history = dailyCounts.map((r: any) => parseInt(r.count));
      const sum = history.reduce((a, b) => a + b, 0);
      const avg = history.length > 0 ? sum / history.length : 0;

      const todayStart = new Date();
      todayStart.setHours(0,0,0,0);
      
      const [todayResult] = await db.select({ count: sql<number>`count(*)` })
          .from(alerts)
          .where(and(
              eq(alerts.tenantId, tenantId),
              gte(alerts.createdAt, todayStart)
          ));

      return {
          current: Number(todayResult?.count || 0),
          history: history,
          average: avg
      };
  },

  /**
   * Get Network Traffic Volume (bytes) from ClickHouse
   */
  async getNetworkTrafficStats(tenantId: string) {
      const days = 30;
      const now = new Date();
      const thirtyDaysAgo = new Date(now);
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - days);
      
      const startStr = thirtyDaysAgo.toISOString().replace('T', ' ').replace('Z', '');

      // Group by day in ClickHouse
      const sql = `
        SELECT 
            toDate(timestamp) as day,
            sum(network_bytes_sent + network_bytes_recv) as total_bytes
        FROM security_events
        WHERE tenant_id = {tenantId:String}
            AND timestamp >= {start:DateTime64}
        GROUP BY day
        ORDER BY day ASC
      `;

      const dailyData = await query<{ day: string, total_bytes: string }>(sql, { 
          tenantId, 
          start: startStr 
      });

      const history = dailyData.map(r => Number(r.total_bytes));
      const sum = history.reduce((a, b) => a + b, 0);
      const avg = history.length > 0 ? sum / history.length : 0;

      // Current 24h volume
      const currentSql = `
        SELECT sum(network_bytes_sent + network_bytes_recv) as total
        FROM security_events
        WHERE tenant_id = {tenantId:String}
            AND timestamp >= subtractHours(now(), 24)
      `;
      const [currentRes] = await query<{ total: string }>(currentSql, { tenantId });

      return {
          current: Number(currentRes?.total || 0),
          history: history,
          average: avg
      };
  },

  /**
   * Get API Error Stats (4xx/5xx) from logs
   */
  async getApiErrorStats(tenantId: string) {
      const days = 30;
      const now = new Date();
      const thirtyDaysAgo = new Date(now);
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - days);

      // We'll search for 'error' in titles or description, or specific event_type
      const dailyCounts = await db.execute(sql`
        SELECT 
            to_char(created_at, 'YYYY-MM-DD') as day,
            COUNT(*) as count
        FROM ${alerts}
        WHERE ${alerts.tenantId} = ${tenantId}
            AND (title ILIKE '%error%' OR description ILIKE '%error%')
            AND ${alerts.createdAt} >= ${thirtyDaysAgo.toISOString()}::timestamp
        GROUP BY 1
        ORDER BY 1 ASC
      `);

      const history = dailyCounts.map((r: any) => parseInt(r.count));
      const sum = history.reduce((a, b) => a + b, 0);
      const avg = history.length > 0 ? sum / history.length : 0;

      const todayStart = new Date();
      todayStart.setHours(0,0,0,0);
      
      const [todayResult] = await db.select({ count: sql<number>`count(*)` })
          .from(alerts)
          .where(and(
              eq(alerts.tenantId, tenantId),
              gte(alerts.createdAt, todayStart),
              sql`(${alerts.title} ILIKE '%error%' OR ${alerts.description} ILIKE '%error%')`
          ));

      return {
          current: Number(todayResult?.count || 0),
          history: history,
          average: avg
      };
  }
};
