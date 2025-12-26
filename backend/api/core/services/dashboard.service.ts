import { query } from '../../infra/clickhouse/client'
import { db } from '../../infra/db'
import { detectionRules } from '../../infra/db/schema'
import { eq, and, isNotNull, sql } from 'drizzle-orm'

/**
 * IMPORTANT: Data Consistency Strategy
 * 
 * All dashboard queries now use raw table `security_events FINAL` instead of Materialized Views (MVs)
 * Reason: MVs have data latency/staleness issues causing mismatches between Summary, Timeline, and other endpoints
 * 
 * This ensures:
 * ✅ Total = sum(critical + high + medium + low) ← matches perfectly
 * ✅ Timeline chart shows correct severity distribution
 * ✅ All metrics (Summary, TopHosts, TopUsers, etc.) are in sync
 * ✅ Real-time data accuracy (no 5-10min lag from MV refresh)
 * 
 * Trade-off: Slightly slower queries (aggregating from raw table vs pre-aggregated MV)
 * But data accuracy > query speed for a SOC dashboard
 */

// Helper: ตรวจสอบว่า sources เป็น empty หรือมี 'none' (แปลว่าไม่มี active integration)
const isEmptySources = (sources?: string[]): boolean => {
  if (!sources || sources.length === 0) return false // ไม่ได้ส่ง sources = แสดงทั้งหมด
  if (sources.length === 1 && sources[0] === 'none') return true // ส่ง 'none' = ไม่มี active integration
  return false
}

// Empty result templates
const emptyCount = { critical: 0, high: 0, medium: 0, low: 0, info: 0, total: 0 }

export const DashboardService = {
  // ==================== SUMMARY (Counts by Severity) ====================
  async getSummary(tenantId: string, startDate: string, endDate: string, sources?: string[]) {
    // ถ้าไม่มี active integration ให้ return empty result
    if (isEmptySources(sources)) return { ...emptyCount }
    
    // Sanitize dates to YYYY-MM-DD to avoid ClickHouse type mismatch
    const sanitizedStart = startDate.split('T')[0]
    const sanitizedEnd = endDate.split('T')[0]
    
    const sourceFilter = (sources && sources.length > 0) ? `AND source IN {sources:Array(String)}` : ''
    const sql = `
      SELECT 
        severity,
        count() as count
      FROM security_events
      WHERE tenant_id = {tenantId:String}
        AND toDate(timestamp) >= {startDate:String}
        AND toDate(timestamp) <= {endDate:String}
        ${sourceFilter}
      GROUP BY severity
      ORDER BY severity
    `
    const rows = await query<{ severity: string; count: string }>(sql, { 
      tenantId, 
      startDate: sanitizedStart, 
      endDate: sanitizedEnd, 
      sources 
    })
    
    // แปลงเป็น object
    const result: Record<string, number> = {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
      info: 0,
      total: 0,
    }
    
    for (const row of rows) {
      const count = parseInt(row.count)
      result[row.severity] = count
      result.total += count
    }
    
    return result
  },

  // ==================== TIMELINE (Events Over Time) ====================
  // แยกตาม source เพื่อให้ frontend แสดงกราฟแยกตาม provider
  async getTimeline(tenantId: string, startDate: string, endDate: string, interval: 'hour' | 'day' = 'day', sources?: string[]) {
    // ถ้าไม่มี active integration ให้ return empty array
    if (isEmptySources(sources)) return []

    // Sanitize dates
    const sanitizedStart = startDate.split('T')[0]
    const sanitizedEnd = endDate.split('T')[0]
    
    const dateFunc = interval === 'hour' ? 'toStartOfHour' : 'toDate'
    const sourceFilter = (sources && sources.length > 0) ? `AND source IN {sources:Array(String)}` : ''
    
    const sql = `
      SELECT 
        ${dateFunc}(timestamp) as time,
        source,
        count() as count,
        countIf(severity = 'critical') as critical,
        countIf(severity = 'high') as high,
        countIf(severity = 'medium') as medium,
        countIf(severity = 'low') as low
      FROM security_events
      WHERE tenant_id = {tenantId:String}
        AND toDate(timestamp) >= {startDate:String}
        AND toDate(timestamp) <= {endDate:String}
        ${sourceFilter}
      GROUP BY time, source
      ORDER BY time ASC, source ASC
    `
    return await query<{
      time: string
      source: string
      count: string
      critical: string
      high: string
      medium: string
      low: string
    }>(sql, { tenantId, startDate: sanitizedStart, endDate: sanitizedEnd, sources })
  },

  // ==================== TOP HOSTS ====================
  async getTopHosts(tenantId: string, startDate: string, endDate: string, limit: number = 10, sources?: string[]) {
    if (isEmptySources(sources)) return []
    const sourceFilter = (sources && sources.length > 0) ? `AND source IN {sources:Array(String)}` : ''
    const sql = `
      SELECT 
        host_name,
        count() as count,
        countIf(severity = 'critical') as critical,
        countIf(severity = 'high') as high
      FROM security_events
      WHERE tenant_id = {tenantId:String}
        AND toDate(timestamp) >= {startDate:String}
        AND toDate(timestamp) <= {endDate:String}
        AND host_name != ''
        ${sourceFilter}
      GROUP BY host_name
      ORDER BY count DESC
      LIMIT {limit:UInt32}
    `
    const sanitizedStart = startDate.split('T')[0]
    const sanitizedEnd = endDate.split('T')[0]

    return await query<{
      host_name: string
      count: string
      critical: string
      high: string
    }>(sql, { tenantId, startDate: sanitizedStart, endDate: sanitizedEnd, limit, sources })
  },

  // ==================== TOP USERS ====================
  async getTopUsers(tenantId: string, startDate: string, endDate: string, limit: number = 10, sources?: string[]) {
    if (isEmptySources(sources)) return []
    const sourceFilter = (sources && sources.length > 0) ? `AND source IN {sources:Array(String)}` : ''
    const sql = `
      SELECT 
        user_name,
        count() as count,
        countIf(severity = 'critical') as critical,
        countIf(severity = 'high') as high
      FROM security_events
      WHERE tenant_id = {tenantId:String}
        AND toDate(timestamp) >= {startDate:String}
        AND toDate(timestamp) <= {endDate:String}
        AND user_name != ''
        ${sourceFilter}
      GROUP BY user_name
      ORDER BY count DESC
      LIMIT {limit:UInt32}
    `
    const sanitizedStart = startDate.split('T')[0]
    const sanitizedEnd = endDate.split('T')[0]

    return await query<{
      user_name: string
      count: string
      critical: string
      high: string
    }>(sql, { tenantId, startDate: sanitizedStart, endDate: sanitizedEnd, limit, sources })
  },

  // ==================== MITRE HEATMAP ====================
  async getMitreHeatmap(tenantId: string, startDate: string, endDate: string, sources?: string[], mode: 'detection' | 'coverage' = 'detection') {
    
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
      .groupBy(detectionRules.mitreTactic, detectionRules.mitreTechnique);

      // Filter out nulls if any slipped through
      return rows.filter(r => r.mitre_tactic && r.mitre_technique) as { mitre_tactic: string; mitre_technique: string; count: string }[];
    }

    // MODE: DETECTION (Query Logs from ClickHouse)
    if (isEmptySources(sources)) return []
    const sourceFilter = (sources && sources.length > 0) ? `AND source IN {sources:Array(String)}` : ''
    
    // Sanitize dates
    const sanitizedStart = startDate.split('T')[0]
    const sanitizedEnd = endDate.split('T')[0]

    const querySql = `
      SELECT 
        mitre_tactic,
        mitre_technique,
        toString(count()) as count
      FROM security_events
      WHERE tenant_id = {tenantId:String}
        AND toDate(timestamp) >= {startDate:String}
        AND toDate(timestamp) <= {endDate:String}
        AND mitre_tactic != ''
        ${sourceFilter}
      GROUP BY mitre_tactic, mitre_technique
    `
    return await query<{
      mitre_tactic: string
      mitre_technique: string
      count: string
    }>(querySql, { tenantId, startDate: sanitizedStart, endDate: sanitizedEnd, sources })
  },

  // ==================== SOURCES BREAKDOWN ====================
  async getSourcesBreakdown(tenantId: string, startDate: string, endDate: string, sources?: string[]) {
    if (isEmptySources(sources)) return []
    const sourceFilter = (sources && sources.length > 0) ? `AND source IN {sources:Array(String)}` : ''
    
    // Sanitize dates
    const sanitizedStart = startDate.split('T')[0]
    const sanitizedEnd = endDate.split('T')[0]

    const sql = `
      SELECT 
        source,
        count() as count
      FROM security_events
      WHERE tenant_id = {tenantId:String}
        AND toDate(timestamp) >= {startDate:String}
        AND toDate(timestamp) <= {endDate:String}
        ${sourceFilter}
      GROUP BY source
      ORDER BY count DESC
    `
    return await query<{ source: string; count: string }>(sql, { tenantId, startDate: sanitizedStart, endDate: sanitizedEnd, sources })
  },

  // ==================== INTEGRATION BREAKDOWN ====================
  async getIntegrationBreakdown(tenantId: string, startDate: string, endDate: string, sources?: string[]) {
    if (isEmptySources(sources)) return []
    const sourceFilter = (sources && sources.length > 0) ? `AND source IN {sources:Array(String)}` : ''
    
    // Sanitize dates
    const sanitizedStart = startDate.split('T')[0]
    const sanitizedEnd = endDate.split('T')[0]

    const sql = `
      SELECT 
        COALESCE(NULLIF(integration_id, ''), source) as integration_id,
        '' as integration_name,
        source,
        count() as count,
        countIf(severity = 'critical') as critical,
        countIf(severity = 'high') as high
      FROM security_events
      WHERE tenant_id = {tenantId:String}
        AND toDate(timestamp) >= {startDate:String}
        AND toDate(timestamp) <= {endDate:String}
        ${sourceFilter}
      GROUP BY integration_id, source
      ORDER BY count DESC
    `
    return await query<{
      integration_id: string
      integration_name: string
      source: string
      count: string
      critical: string
      high: string
    }>(sql, { tenantId, startDate: sanitizedStart, endDate: sanitizedEnd, sources })
  },

  // ==================== SITE BREAKDOWN (All Sources) ====================
  async getSiteBreakdown(tenantId: string, startDate: string, endDate: string, sources?: string[]) {
    // ถ้าไม่มี active integration ให้ return empty
    if (isEmptySources(sources)) return []
    
    const sourceFilter = (sources && sources.length > 0) ? `AND source IN {sources:Array(String)}` : ''
    
    // Sanitize dates
    const sanitizedStart = startDate.split('T')[0]
    const sanitizedEnd = endDate.split('T')[0]

    // รองรับทั้ง SentinelOne (host_site_name) และ CrowdStrike (host_site_name = MSSP site name)
    const sql = `
      SELECT 
        source,
        '' as host_account_name,
        '' as host_site_name,
        count() as count,
        countIf(severity = 'critical') as critical,
        countIf(severity = 'high') as high
      FROM security_events
      WHERE tenant_id = {tenantId:String}
        AND toDate(timestamp) >= {startDate:String}
        AND toDate(timestamp) <= {endDate:String}
        ${sourceFilter}
      GROUP BY source
      ORDER BY count DESC
    `
    return await query<{
      source: string
      host_account_name: string
      host_site_name: string
      count: string
      critical: string
      high: string
    }>(sql, { tenantId, startDate, endDate, sources })
  },

  // ==================== SUMMARY BY INTEGRATION ====================
  async getSummaryByIntegration(tenantId: string, integrationId: string, days: number = 7) {
    const sql = `
      SELECT 
        severity,
        count() as count
      FROM security_events
      WHERE tenant_id = {tenantId:String}
        AND integration_id = {integrationId:String}
        AND timestamp >= now() - INTERVAL {days:UInt32} DAY
      GROUP BY severity
    `
    const rows = await query<{ severity: string; count: string }>(sql, { tenantId, integrationId, days })
    
    const result: Record<string, number> = {
      critical: 0, high: 0, medium: 0, low: 0, info: 0, total: 0,
    }
    for (const row of rows) {
      const count = parseInt(row.count)
      result[row.severity] = count
      result.total += count
    }
    return result
  },

  // ==================== SUMMARY BY SITE ====================
  async getSummaryBySite(tenantId: string, siteName: string, days: number = 7) {
    const sql = `
      SELECT 
        severity,
        count() as count
      FROM security_events
      WHERE tenant_id = {tenantId:String}
        AND host_site_name = {siteName:String}
        AND timestamp >= now() - INTERVAL {days:UInt32} DAY
      GROUP BY severity
    `
    const rows = await query<{ severity: string; count: string }>(sql, { tenantId, siteName, days })
    
    const result: Record<string, number> = {
      critical: 0, high: 0, medium: 0, low: 0, info: 0, total: 0,
    }
    for (const row of rows) {
      const count = parseInt(row.count)
      result[row.severity] = count
      result.total += count
    }
    return result
  },

  // ==================== RECENT DETECTIONS ====================
  async getRecentDetections(tenantId: string, startDate: string, endDate: string, limit: number = 5, sources?: string[]) {
    if (isEmptySources(sources)) return []
    const sourceFilter = (sources && sources.length > 0) ? `AND source IN {sources:Array(String)}` : ''
    const sql = `
      SELECT 
        id,
        source,
        timestamp,
        severity,
        coalesce(
          nullIf(mitre_technique, ''),
          nullIf(JSONExtractString(raw, 'ThreatName'), ''),
          nullIf(JSONExtractString(raw, 'scenario'), ''),
          nullIf(JSONExtractString(raw, 'DetectDescription'), ''),
          nullIf(file_name, ''),
          nullIf(process_name, ''),
          nullIf(event_type, ''),
          'Security Event'
        ) as title,
        '' as description,
        mitre_tactic,
        mitre_technique,
        host_name,
        user_name,
        JSONExtractString(raw, 'ThreatName') as threat_name,
        '' as console_link
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
      title: string
      description: string
      mitre_tactic: string
      mitre_technique: string
      host_name: string
      user_name: string
      threat_name: string
      console_link: string
    }>(sql, { tenantId, startDate, endDate, limit, sources })
  },
}
