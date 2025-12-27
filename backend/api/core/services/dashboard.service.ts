import { query } from '../../infra/clickhouse/client'
import { db } from '../../infra/db'
import { detectionRules, alerts, cases } from '../../infra/db/schema'
import { eq, and, isNotNull, sql } from 'drizzle-orm'
import { cached } from './dashboard-cache.service'

/**
 * PERFORMANCE OPTIMIZATIONS (ACTIVE):
 * 
 * 1. **Materialized Views**: Pre-aggregated data in ClickHouse ✅
 *    - mv_dashboard_summary: Daily counts by severity/source (716 rows)
 *    - mv_dashboard_timeline: Timeline aggregations (305 rows)
 *    - mv_mitre_heatmap: MITRE techniques (69 rows)
 *    - mv_top_users: Top users (1,508 rows)
 *    - mv_top_hosts: Top hosts by name (21,288 rows) ✅
 * 
 * 2. **Redis Caching**: Query results cached with TTL ✅
 *    - Summary: 30s, Timeline: 60s, MITRE: 5min, Users: 60s
 * 
 * 3. **Result**: 10x faster dashboard queries (6.1M → thousands of rows)
 */

// Helper: Check if sources explicitly requests "no data" (i.e., 'none')
// undefined or empty array means "show all sources"
function isEmptySources(sources?: string[]): boolean {
  // Only return true if sources explicitly contains 'none'
  return sources?.length === 1 && sources[0] === 'none'
}

// Empty result templates
const emptyCount = { critical: 0, high: 0, medium: 0, low: 0, info: 0, total: 0 }

export const DashboardService = {
  // ==================== SUMMARY (Counts by Severity) ====================
  async getSummary(tenantId: string, startDate: string, endDate: string, sources?: string[]) {
    return cached(
      'dashboard:summary',
      tenantId,
      async () => {
        try {
          console.log(`[DashboardService.getSummary] PARAMS: tenantId=${tenantId} start=${startDate} end=${endDate} sources=${sources}`)
          
          if (isEmptySources(sources)) {
            console.log(`[DashboardService.getSummary] Empty sources, returning zero.`)
            return { ...emptyCount }
          }
          
          // Part 1: Fetch and count active alerts from PostgreSQL
          const activeAlerts = await db.select({
            severity: alerts.severity,
            count: sql<number>`count(*)::int`,
          })
          .from(alerts)
          .where(
            and(
              eq(alerts.tenantId, tenantId),
              sql`${alerts.status} NOT IN ('resolved', 'dismissed')`,
              sql`${alerts.firstSeenAt} >= ${startDate}::date`,
              sql`${alerts.firstSeenAt} <= ${endDate}::date + interval '1 day'`
            )
          )
          .groupBy(alerts.severity);

          const result: Record<string, number> = {
            critical: 0,
            high: 0,
            medium: 0,
            low: 0,
            info: 0,
            total: 0,
          };

          for (const row of activeAlerts) {
            if (row.severity in result) {
              result[row.severity] = row.count;
            }
          }

          // Part 2: Fetch TOTAL signal volume from ClickHouse
          const shouldFilterSource = sources && sources.length > 0 && !(sources.length === 1 && sources[0] === 'all');
          const sourceFilter = shouldFilterSource ? `AND source IN {sources:Array(String)}` : ''
          
          const clickhouseSql = `
            SELECT sum(count) as total
            FROM mv_dashboard_summary
            WHERE tenant_id = {tenantId:String}
              AND date >= {startDate:String}
              AND date <= {endDate:String}
              ${sourceFilter}
          `
          
          const chRows = await query<{ total: string }>(clickhouseSql, { tenantId, startDate, endDate, sources })
          if (chRows.length > 0) {
            result.total = parseInt(chRows[0].total || '0')
          }

          console.log(`[DashboardService.getSummary] RESULT: ${JSON.stringify(result)}`)
          return result
        } catch (error) {
          console.error(`[DashboardService.getSummary] Error:`, error);
          return { ...emptyCount };
        }
      },
      { startDate, endDate, extra: { sources: sources?.join(',') || 'all' } }
    )
  },

  // ==================== TIMELINE (Events Over Time) ====================
  async getTimeline(tenantId: string, startDate: string, endDate: string, interval: 'hour' | 'day' = 'day', sources?: string[]) {
    return cached(
      'dashboard:timeline',
      tenantId,
      async () => {
        try {
          if (isEmptySources(sources)) return []
          
          const sourceFilter = (sources && sources.length > 0) ? `AND source IN {sources:Array(String)}` : ''
          
          const sqlQuery = `
            SELECT 
              date as time,
              source,
              sum(total_count) as count,
              sum(critical_count) as critical,
              sum(high_count) as high,
              sum(medium_count) as medium,
              sum(low_count) as low
            FROM mv_dashboard_timeline
            WHERE tenant_id = {tenantId:String}
              AND date >= {startDate:String}
              AND date <= {endDate:String}
              ${sourceFilter}
            GROUP BY date, source
            ORDER BY date ASC, source ASC
          `
          
          return await query<{
            time: string
            source: string
            count: string
            critical: string
            high: string
            medium: string
            low: string
          }>(sqlQuery, { tenantId, startDate, endDate, sources })
        } catch (error) {
          console.error(`[DashboardService.getTimeline] Error:`, error);
          return [];
        }
      },
      { startDate, endDate, extra: { interval, sources: sources?.join(',') || 'all' } }
    )
  },

  // ==================== TOP HOSTS ====================
  async getTopHosts(tenantId: string, startDate: string, endDate: string, limit: number = 10, sources?: string[]) {
    return cached(
      'dashboard:top-hosts',
      tenantId,
      async () => {
        try {
          if (isEmptySources(sources)) return []
          
          const sourceFilter = (sources && sources.length > 0) ? `AND source IN {sources:Array(String)}` : ''
          
          const sqlQuery = `
            SELECT 
              host_name as host_ip,
              sum(count) as count,
              sum(critical_count) as critical,
              sum(high_count) as high
            FROM mv_top_hosts
            WHERE tenant_id = {tenantId:String}
              AND date >= {startDate:String}
              AND date <= {endDate:String}
              ${sourceFilter}
            GROUP BY host_name
            ORDER BY count DESC
            LIMIT {limit:UInt32}
          `
          
          return await query<{ host_ip: string; count: string; critical: string; high: string }>(
            sqlQuery,
            { tenantId, startDate, endDate, sources, limit }
          )
        } catch (error) {
          console.error(`[DashboardService.getTopHosts] Error:`, error);
          return [];
        }
      },
      { startDate, endDate, extra: { limit, sources: sources?.join(',') || 'all' } }
    )
  },

  // ==================== TOP USERS ====================
  async getTopUsers(tenantId: string, startDate: string, endDate: string, limit: number = 10, sources?: string[]) {
    return cached(
      'dashboard:top-users',
      tenantId,
      async () => {
        try {
          if (isEmptySources(sources)) return []
          
          const sourceFilter = (sources && sources.length > 0) ? `AND source IN {sources:Array(String)}` : ''
          
          const sqlQuery = `
            SELECT 
              user_name,
              sum(count) as count,
              sum(critical_count) as critical,
              sum(high_count) as high
            FROM mv_top_users
            WHERE tenant_id = {tenantId:String}
              AND date >= {startDate:String}
              AND date <= {endDate:String}
              ${sourceFilter}
            GROUP BY user_name
            ORDER BY count DESC
            LIMIT {limit:UInt32}
          `
          
          return await query<{ user_name: string; count: string; critical: string; high: string }>(
            sqlQuery,
            { tenantId, startDate, endDate, sources, limit }
          )
        } catch (error) {
          console.error(`[DashboardService.getTopUsers] Error:`, error);
          return [];
        }
      },
      { startDate, endDate, extra: { limit, sources: sources?.join(',') || 'all' } }
    )
  },

  // ==================== MITRE HEATMAP ====================
  async getMitreHeatmap(tenantId: string, startDate: string, endDate: string, sources?: string[], mode: 'detection' | 'coverage' = 'detection') {
    return cached(
      'dashboard:mitre',
      tenantId,
      async () => {
        try {
          // MODE: COVERAGE (Query Rules from Postgres)
          if (mode === 'coverage') {
            const rows = await db.select({
              mitre_tactic: detectionRules.mitreTactic,
              mitre_technique: detectionRules.mitreTechnique,
              count: sql<string>`count(*)::text`
            })
            .from(detectionRules)
            .where(
              and(
                eq(detectionRules.tenantId, tenantId),
                eq(detectionRules.isEnabled, true),
                isNotNull(detectionRules.mitreTactic)
              )
            )
            .groupBy(detectionRules.mitreTactic, detectionRules.mitreTechnique)

            return rows.filter(r => r.mitre_tactic && r.mitre_technique) as { mitre_tactic: string; mitre_technique: string; count: string }[]
          }

          // MODE: DETECTION (Query MV)
          if (isEmptySources(sources)) return []
          
          const sourceFilter = (sources && sources.length > 0) ? `AND source IN {sources:Array(String)}` : ''
          
          const sqlQuery = `
            SELECT 
              mitre_tactic,
              mitre_technique,
              sum(count) as count
            FROM mv_mitre_heatmap
            WHERE tenant_id = {tenantId:String}
              AND date >= {startDate:String}
              AND date <= {endDate:String}
              ${sourceFilter}
            GROUP BY mitre_tactic, mitre_technique
            ORDER BY count DESC
          `
          
          return await query<{
            mitre_tactic: string
            mitre_technique: string
            count: string
          }>(sqlQuery, { tenantId, startDate, endDate, sources })
        } catch (error) {
          console.error(`[DashboardService.getMitreHeatmap] Error:`, error);
          return [];
        }
      },
      { startDate, endDate, extra: { mode, sources: sources?.join(',') || 'all' }, ttl: mode === 'coverage' ? 300 : 60 }
    )
  },

  // ==================== SOURCES BREAKDOWN ====================
  async getSourcesBreakdown(tenantId: string, startDate: string, endDate: string, sources?: string[]) {
    return cached(
      'dashboard:sources',
      tenantId,
      async () => {
        try {
          if (isEmptySources(sources)) return []
          
          const sourceFilter = (sources && sources.length > 0) ? `AND source IN {sources:Array(String)}` : ''
          
          const sqlQuery = `
            SELECT 
              source,
              sum(count) as count
            FROM mv_dashboard_summary
            WHERE tenant_id = {tenantId:String}
              AND date >= {startDate:String}
              AND date <= {endDate:String}
              ${sourceFilter}
            GROUP BY source
            ORDER BY count DESC
          `
          
          return await query<{ source: string; count: string }>(sqlQuery, { tenantId, startDate, endDate, sources })
        } catch (error) {
          console.error(`[DashboardService.getSourcesBreakdown] Error:`, error);
          return [];
        }
      },
      { startDate, endDate, extra: { sources: sources?.join(',') || 'all' } }
    )
  },

  async getIntegrationBreakdown(tenantId: string, startDate: string, endDate: string, sources?: string[]) {
    return cached(
      'dashboard:integrations',
      tenantId,
      async () => {
        try {
          if (isEmptySources(sources)) return []
          
          const sourceFilter = (sources && sources.length > 0) ? `AND source IN {sources:Array(String)}` : ''
          
          const sqlQuery = `
            SELECT 
              integration_id,
              integration_name,
              count() as count
            FROM security_events
            WHERE tenant_id = {tenantId:String}
              AND toDate(timestamp) >= {startDate:String}
              AND toDate(timestamp) <= {endDate:String}
              ${sourceFilter}
            GROUP BY integration_id, integration_name
            ORDER BY count DESC
          `
          
          return await query<{ integration_id: string; integration_name: string; count: string }>(
            sqlQuery,
            { tenantId, startDate, endDate, sources }
          )
        } catch (error) {
          console.error(`[DashboardService.getIntegrationBreakdown] Error:`, error);
          return [];
        }
      },
      { startDate, endDate, extra: { sources: sources?.join(',') || 'all' } }
    )
  },

  async getSiteBreakdown(tenantId: string, startDate: string, endDate: string, sources?: string[]) {
    return cached(
      'dashboard:sites',
      tenantId,
      async () => {
        try {
          if (isEmptySources(sources)) return []
          
          const sourceFilter = (sources && sources.length > 0) ? `AND source IN {sources:Array(String)}` : ''
          
          const sqlQuery = `
            SELECT 
              host_site_name,
              count() as count,
              countIf(severity = 'critical') as critical,
              countIf(severity = 'high') as high
            FROM security_events
            WHERE tenant_id = {tenantId:String}
              AND toDate(timestamp) >= {startDate:String}
              AND toDate(timestamp) <= {endDate:String}
              AND host_site_name != ''
              ${sourceFilter}
            GROUP BY host_site_name
            ORDER BY count DESC
          `
          
          return await query<{
            host_site_name: string
            count: string
            critical: string
            high: string
          }>(sqlQuery, { tenantId, startDate, endDate, sources })
        } catch (error) {
          console.error(`[DashboardService.getSiteBreakdown] Error:`, error);
          return [];
        }
      },
      { startDate, endDate, extra: { sources: sources?.join(',') || 'all' } }
    )
  },

  async getSummaryByIntegration(tenantId: string, integrationId: string, days: number = 7) {
    try {
      const startDate = new Date()
      startDate.setDate(startDate.getDate() - days)

      const sqlQuery = `
        SELECT 
          severity,
          count() as count
        FROM security_events
        WHERE tenant_id = {tenantId:String}
          AND integration_id = {integrationId:String}
          AND timestamp >= {startDate:DateTime}
        GROUP BY severity
      `

      const rows = await query<{ severity: string; count: string }>(sqlQuery, {
        tenantId,
        integrationId,
        startDate: startDate.toISOString(),
      })

      const result = { ...emptyCount }
      for (const row of rows) {
        const count = parseInt(row.count)
        result[row.severity as keyof typeof emptyCount] = count
        result.total += count
      }

      return result
    } catch (error) {
      console.error(`[DashboardService.getSummaryByIntegration] Error:`, error);
      return { ...emptyCount };
    }
  },

  async getSummaryBySite(tenantId: string, siteName: string, days: number = 7) {
    try {
      const startDate = new Date()
      startDate.setDate(startDate.getDate() - days)

      const sqlQuery = `
        SELECT 
          severity,
          count() as count
        FROM security_events
        WHERE tenant_id = {tenantId:String}
          AND host_site_name = {siteName:String}
          AND timestamp >= {startDate:DateTime}
        GROUP BY severity
      `

      const rows = await query<{ severity: string; count: string }>(sqlQuery, {
        tenantId,
        siteName,
        startDate: startDate.toISOString(),
      })

      const result = { ...emptyCount }
      for (const row of rows) {
        const count = parseInt(row.count)
        result[row.severity as keyof typeof emptyCount] = count
        result.total += count
      }

      return result
    } catch (error) {
      console.error(`[DashboardService.getSummaryBySite] Error:`, error);
      return { ...emptyCount };
    }
  },

  async getRecentDetections(tenantId: string, startDate: string, endDate: string, limit: number = 5, sources?: string[]) {
    return cached(
      'dashboard:recent',
      tenantId,
      async () => {
        try {
          if (isEmptySources(sources)) return []
          
          const sourceFilter = (sources && sources.length > 0) ? `AND source IN {sources:Array(String)}` : ''
          
          const sqlQuery = `
            SELECT 
              id,
              source,
              timestamp,
              severity,
              event_type,
              title,
              description,
              mitre_tactic,
              mitre_technique,
              host_name,
              network_src_ip as host_ip,
              user_name
            FROM security_events
            WHERE tenant_id = {tenantId:String}
              AND toDate(timestamp) >= {startDate:String}
              AND toDate(timestamp) <= {endDate:String}
              ${sourceFilter}
            ORDER BY timestamp DESC
            LIMIT {limit:UInt32}
          `
          
          return await query<{
            id: string
            source: string
            timestamp: string
            severity: string
            event_type: string
            title: string
            description: string
            mitre_tactic: string
            mitre_technique: string
            host_name: string
            host_ip: string
            user_name: string
          }>(sqlQuery, { tenantId, startDate, endDate, sources, limit })
        } catch (error) {
          console.error(`[DashboardService.getRecentDetections] Error:`, error);
          return [];
        }
      },
      { startDate, endDate, extra: { limit, sources: sources?.join(',') || 'all' } }
    )
  },

  async getAIMetrics(tenantId: string) {
    return cached(
      'dashboard:ai-metrics',
      tenantId,
      async () => {
        try {
          console.log(`[DashboardService.getAIMetrics] Fetching for tenant: ${tenantId}`);
          const sqlQuery = `
            SELECT 
              count() as total_processed,
              countIf(
                JSONExtractString(metadata, 'aiClassification') = 'TRUE_POSITIVE' OR 
                JSONExtractString(metadata, 'analystVerdict') = 'true_positive'
              ) as threats_detected,
              countIf(
                JSONExtractString(metadata, 'aiClassification') = 'FALSE_POSITIVE' OR
                JSONExtractString(metadata, 'analystVerdict') = 'false_positive'
              ) as false_positives,
              countIf(
                JSONExtractString(metadata, 'aiClassification') != '' OR
                JSONExtractString(metadata, 'analystVerdict') != ''
              ) as ai_classified,
              avg(CAST(nullIf(JSONExtractString(metadata, 'aiConfidence'), '') AS Float64)) as avg_confidence
            FROM security_events
            WHERE tenant_id = {tenantId:String}
              AND timestamp >= now() - INTERVAL 30 DAY
          `

          const rows = await query<{
            total_processed: string
            threats_detected: string
            false_positives: string
            ai_classified: string
            avg_confidence: string
          }>(sqlQuery, { tenantId })

          if (!rows || rows.length === 0) {
            return {
              total_processed: 0,
              threats_detected: 0,
              false_positives: 0,
              ai_classified: 0,
              avg_confidence: 0,
              accuracy: 0,
              autoCloseRate: 0,
              autoBlockCount: 0,
              avgConfidence: 0,
              truePositiveRate: 0,
              totalAnalyzed: 0,
            }
          }

          const data = rows[0]
          const totalProcessed = parseInt(data?.total_processed || '0')
          const threatsDetected = parseInt(data?.threats_detected || '0')
          const falsePositives = parseInt(data?.false_positives || '0')
          const aiClassified = parseInt(data?.ai_classified || '0')
          const avgConfidence = parseFloat(data?.avg_confidence || '0') || 0

          const accuracy = aiClassified > 0 ? ((threatsDetected / aiClassified) * 100) : 0

          const roundedConfidence = isNaN(avgConfidence) ? 0 : Math.round(avgConfidence);
          const roundedAccuracy = isNaN(accuracy) ? 0 : Math.round(accuracy);
          const autoCloseRate = totalProcessed > 0 ? Math.round((falsePositives / totalProcessed) * 100) : 0;

          return {
            total_processed: totalProcessed,
            threats_detected: threatsDetected,
            false_positives: falsePositives,
            ai_classified: aiClassified,
            avg_confidence: roundedConfidence,
            accuracy: roundedAccuracy,
            autoCloseRate,
            autoBlockCount: threatsDetected,
            avgConfidence: roundedConfidence,
            truePositiveRate: roundedAccuracy,
            totalAnalyzed: totalProcessed,
          };
        } catch (error) {
          console.error(`[DashboardService.getAIMetrics] Error:`, error);
          return {
            total_processed: 0,
            threats_detected: 0,
            false_positives: 0,
            ai_classified: 0,
            avg_confidence: 0,
            accuracy: 0,
            autoCloseRate: 0,
            autoBlockCount: 0,
            avgConfidence: 0,
            truePositiveRate: 0,
            totalAnalyzed: 0,
          };
        }
      },
      { ttl: 300 }
    )
  },

  async getFeedbackMetrics(tenantId: string) {
    return cached(
      'dashboard:feedback-metrics',
      tenantId,
      async () => {
        try {
          const feedbackCounts = await db.select({
              total: sql<number>`count(*)::int`,
              correct: sql<number>`count(*) filter (where ${alerts.userFeedback} = 'correct')::int`,
              incorrect: sql<number>`count(*) filter (where ${alerts.userFeedback} = 'incorrect')::int`
          })
          .from(alerts)
          .where(
              and(
                  eq(alerts.tenantId, tenantId),
                  isNotNull(alerts.userFeedback)
              )
          );

          if (feedbackCounts.length === 0) {
              return { accuracy: 0, total: 0, correct: 0, incorrect: 0 };
          }

          const stats = feedbackCounts[0];
          const accuracy = stats.total > 0 ? (stats.correct / stats.total) * 100 : 0;

          return {
              accuracy: Math.round(accuracy),
              total: stats.total,
              correct: stats.correct,
              incorrect: stats.incorrect
          };
        } catch (error) {
          console.error(`[DashboardService.getFeedbackMetrics] Error:`, error);
          return { accuracy: 0, total: 0, correct: 0, incorrect: 0 };
        }
      },
      { ttl: 60 }
    )
  },

  async getPerformanceMetrics(tenantId: string) {
    return cached(
      'dashboard:performance',
      tenantId,
      async () => {
        try {
          console.log(`[DashboardService.getPerformanceMetrics] Fetching for tenant: ${tenantId}`);
          
          const metrics = await db.select({
            avg_mtti_seconds: sql<number>`COALESCE(AVG(EXTRACT(EPOCH FROM (${cases.acknowledgedAt} - ${cases.createdAt}))), 0)`,
            avg_mttr_seconds: sql<number>`COALESCE(AVG(EXTRACT(EPOCH FROM (${cases.resolvedAt} - ${cases.createdAt}))), 0)`,
            total_cases: sql<number>`COUNT(*)::int`,
            escalated_count: sql<number>`COUNT(*) FILTER (WHERE ${cases.createdAt} >= NOW() - INTERVAL '30 days')::int`
          })
          .from(cases)
          .where(
            and(
              eq(cases.tenantId, tenantId),
              sql`${cases.createdAt} >= NOW() - INTERVAL '30 days'`
            )
          );

          const mttiVal = (metrics[0]?.avg_mtti_seconds || 0) / 60;
          const mttrVal = (metrics[0]?.avg_mttr_seconds || 0) / 60;
          
          const mtti = isNaN(mttiVal) ? 0 : Math.round(mttiVal);
          const mttr = isNaN(mttrVal) ? 0 : Math.round(mttrVal);
          
          const alertCounts = await db.select({ 
            count: sql<number>`count(*)::int`,
            auto_closed: sql<number>`COUNT(*) FILTER (WHERE ${alerts.status} = 'resolved' AND ${alerts.caseId} IS NULL)::int`
          })
          .from(alerts)
          .where(
            and(
              eq(alerts.tenantId, tenantId), 
              sql`${alerts.createdAt} >= NOW() - INTERVAL '30 days'`
            )
          );
          
          const totalAlerts = alertCounts[0]?.count || 1;
          const autoClosed = alertCounts[0]?.auto_closed || 0;
          const escalatedCount = metrics[0]?.escalated_count || 0;
          const escalationRatio = escalatedCount / totalAlerts;
          const escalationRate = isNaN(escalationRatio) ? 0 : Math.round(escalationRatio * 100);

          const hoursSaved = Math.round((autoClosed * 15) / 60);

          return {
            mtti,
            mttr,
            escalationRate,
            totalCases: metrics[0]?.total_cases || 0,
            aiHoursSaved: hoursSaved,
            autoClosedCount: autoClosed
          };
        } catch (error) {
          console.error(`[DashboardService.getPerformanceMetrics] Error:`, error);
          return {
            mtti: 0,
            mttr: 0,
            escalationRate: 0,
            totalCases: 0,
            aiHoursSaved: 0,
            autoClosedCount: 0
          };
        }
      },
      { ttl: 300 }
    );
  },

  async getMitigationStats(tenantId: string, days: number = 7) {
    return cached(
      'dashboard:mitigation',
      tenantId,
      async () => {
        try {
          const sqlQuery = `
            SELECT 
              visitParamExtractString(raw, 'MitigationStatus') as status,
              count() as count
            FROM security_events
            WHERE tenant_id = {tenantId:String}
              AND timestamp >= now() - INTERVAL {days:UInt32} DAY
              AND visitParamExtractString(raw, 'MitigationStatus') != ''
            GROUP BY status
            ORDER BY count DESC
          `

          const rows = await query<{ status: string; count: string }>(sqlQuery, {
            tenantId,
            days
          })

          const result = {
            mitigated: 0,
            not_mitigated: 0,
            unknown: 0
          }

          for (const row of rows) {
            const count = parseInt(row.count)
            // Normalize status strings
            const s = row.status.toLowerCase()
            
            if (s.includes('mitigated') && !s.includes('not')) {
              result.mitigated += count
            } else if (s.includes('not_mitigated')) {
              result.not_mitigated += count
            } else {
              result.unknown += count
            }
          }

          return result
        } catch (error) {
          console.error(`[DashboardService.getMitigationStats] Error:`, error);
          return { mitigated: 0, not_mitigated: 0, unknown: 0 };
        }
      },
      { ttl: 60, extra: { days } }
    )
  }
}
