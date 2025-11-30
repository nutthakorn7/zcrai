import { query } from '../../infra/clickhouse/client'

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
    
    const sourceFilter = (sources && sources.length > 0) ? `AND source IN {sources:Array(String)}` : ''
    const sql = `
      SELECT 
        severity,
        sum(event_count) as count
      FROM security_events_daily_mv
      WHERE tenant_id = {tenantId:String}
        AND date >= {startDate:String}
        AND date <= {endDate:String}
        ${sourceFilter}
      GROUP BY severity
    `
    const rows = await query<{ severity: string; count: string }>(sql, { tenantId, startDate, endDate, sources })
    
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
  async getTimeline(tenantId: string, startDate: string, endDate: string, interval: 'hour' | 'day' = 'day', sources?: string[]) {
    // ถ้าไม่มี active integration ให้ return empty array
    if (isEmptySources(sources)) return []
    
    const dateFunc = interval === 'hour' ? 'toStartOfHour' : 'toDate'
    const sourceFilter = (sources && sources.length > 0) ? `AND source IN {sources:Array(String)}` : ''
    
    const sql = `
      SELECT 
        ${dateFunc}(timestamp) as time,
        count() as count,
        countIf(severity = 'critical') as critical,
        countIf(severity = 'high') as high,
        countIf(severity = 'medium') as medium,
        countIf(severity = 'low') as low
      FROM security_events FINAL
      WHERE tenant_id = {tenantId:String}
        AND toDate(timestamp) >= {startDate:String}
        AND toDate(timestamp) <= {endDate:String}
        ${sourceFilter}
      GROUP BY time
      ORDER BY time
    `
    return await query<{
      time: string
      count: string
      critical: string
      high: string
      medium: string
      low: string
    }>(sql, { tenantId, startDate, endDate, sources })
  },

  // ==================== TOP HOSTS ====================
  async getTopHosts(tenantId: string, startDate: string, endDate: string, limit: number = 10, sources?: string[]) {
    if (isEmptySources(sources)) return []
    const sourceFilter = (sources && sources.length > 0) ? `AND source IN {sources:Array(String)}` : ''
    const sql = `
      SELECT 
        host_name,
        sum(event_count) as count,
        sum(critical_count) as critical,
        sum(high_count) as high
      FROM security_events_top_hosts_mv
      WHERE tenant_id = {tenantId:String}
        AND date >= {startDate:String}
        AND date <= {endDate:String}
        AND host_name != ''
        ${sourceFilter}
      GROUP BY host_name
      ORDER BY count DESC
      LIMIT {limit:UInt32}
    `
    return await query<{
      host_name: string
      count: string
      critical: string
      high: string
    }>(sql, { tenantId, startDate, endDate, limit, sources })
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
      FROM security_events FINAL
      WHERE tenant_id = {tenantId:String}
        AND toDate(timestamp) >= {startDate:String}
        AND toDate(timestamp) <= {endDate:String}
        AND user_name != ''
        ${sourceFilter}
      GROUP BY user_name
      ORDER BY count DESC
      LIMIT {limit:UInt32}
    `
    return await query<{
      user_name: string
      count: string
      critical: string
      high: string
    }>(sql, { tenantId, startDate, endDate, limit, sources })
  },

  // ==================== MITRE HEATMAP ====================
  async getMitreHeatmap(tenantId: string, startDate: string, endDate: string, sources?: string[]) {
    if (isEmptySources(sources)) return []
    const sourceFilter = (sources && sources.length > 0) ? `AND source IN {sources:Array(String)}` : ''
    const sql = `
      SELECT 
        mitre_tactic,
        mitre_technique,
        sum(event_count) as count
      FROM security_events_mitre_mv
      WHERE tenant_id = {tenantId:String}
        AND date >= {startDate:String}
        AND date <= {endDate:String}
        AND (mitre_tactic != '' OR mitre_technique != '')
        ${sourceFilter}
      GROUP BY mitre_tactic, mitre_technique
      ORDER BY count DESC
    `
    return await query<{
      mitre_tactic: string
      mitre_technique: string
      count: string
    }>(sql, { tenantId, startDate, endDate, sources })
  },

  // ==================== SOURCES BREAKDOWN ====================
  async getSourcesBreakdown(tenantId: string, startDate: string, endDate: string, sources?: string[]) {
    if (isEmptySources(sources)) return []
    const sourceFilter = (sources && sources.length > 0) ? `AND source IN {sources:Array(String)}` : ''
    const sql = `
      SELECT 
        source,
        sum(event_count) as count
      FROM security_events_daily_mv
      WHERE tenant_id = {tenantId:String}
        AND date >= {startDate:String}
        AND date <= {endDate:String}
        ${sourceFilter}
      GROUP BY source
    `
    return await query<{ source: string; count: string }>(sql, { tenantId, startDate, endDate, sources })
  },

  // ==================== INTEGRATION BREAKDOWN ====================
  async getIntegrationBreakdown(tenantId: string, startDate: string, endDate: string, sources?: string[]) {
    if (isEmptySources(sources)) return []
    const sourceFilter = (sources && sources.length > 0) ? `AND source IN {sources:Array(String)}` : ''
    const sql = `
      SELECT 
        integration_id,
        integration_name,
        source,
        count() as count,
        countIf(severity = 'critical') as critical,
        countIf(severity = 'high') as high
      FROM security_events FINAL
      WHERE tenant_id = {tenantId:String}
        AND toDate(timestamp) >= {startDate:String}
        AND toDate(timestamp) <= {endDate:String}
        AND integration_id != ''
        ${sourceFilter}
      GROUP BY integration_id, integration_name, source
      ORDER BY count DESC
    `
    return await query<{
      integration_id: string
      integration_name: string
      source: string
      count: string
      critical: string
      high: string
    }>(sql, { tenantId, startDate, endDate, sources })
  },

  // ==================== SITE BREAKDOWN (Dynamic Source Filter) ====================
  async getSiteBreakdown(tenantId: string, startDate: string, endDate: string, sources?: string[]) {
    // ถ้าไม่มี active integration ให้ return empty
    if (isEmptySources(sources)) return []
    
    // Sites are primarily for SentinelOne. 
    // If 'sources' is provided and doesn't include 'sentinelone', return empty.
    if (sources && sources.length > 0 && !sources.includes('sentinelone')) {
      return []
    }
    
    // We still only fetch sites for sentinelone source explicitly in the query for safety/speed
    // even if 'crowdstrike' is in the list, it won't match site query logic usually unless generalized
    // For now, we stick to S1 sites but allow it only if S1 is allowed.
    
    const sql = `
      SELECT 
        host_account_name,
        host_site_name,
        count() as count,
        countIf(severity = 'critical') as critical,
        countIf(severity = 'high') as high
      FROM security_events FINAL
      WHERE tenant_id = {tenantId:String}
        AND toDate(timestamp) >= {startDate:String}
        AND toDate(timestamp) <= {endDate:String}
        AND source = 'sentinelone'
        AND host_site_name != ''
      GROUP BY host_account_name, host_site_name
      ORDER BY count DESC
    `
    return await query<{
      host_account_name: string
      host_site_name: string
      count: string
      critical: string
      high: string
    }>(sql, { tenantId, startDate, endDate })
  },

  // ==================== SUMMARY BY INTEGRATION ====================
  async getSummaryByIntegration(tenantId: string, integrationId: string, days: number = 7) {
    const sql = `
      SELECT 
        severity,
        count() as count
      FROM security_events FINAL
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
      FROM security_events FINAL
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
}
