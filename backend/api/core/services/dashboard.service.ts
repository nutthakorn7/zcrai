import { query } from '../../infra/clickhouse/client'

export const DashboardService = {
  // ==================== SUMMARY (Counts by Severity) ====================
  async getSummary(tenantId: string, days: number = 7) {
    const sql = `
      SELECT 
        severity,
        sum(event_count) as count
      FROM security_events_daily_mv
      WHERE tenant_id = {tenantId:String}
        AND date >= today() - {days:UInt32}
      GROUP BY severity
    `
    const rows = await query<{ severity: string; count: string }>(sql, { tenantId, days })
    
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
  async getTimeline(tenantId: string, days: number = 7, interval: 'hour' | 'day' = 'day') {
    const dateFunc = interval === 'hour' ? 'toStartOfHour' : 'toDate'
    
    const sql = `
      SELECT 
        ${dateFunc}(timestamp) as time,
        count() as count,
        countIf(severity = 'critical') as critical,
        countIf(severity = 'high') as high,
        countIf(severity = 'medium') as medium,
        countIf(severity = 'low') as low
      FROM security_events
      WHERE tenant_id = {tenantId:String}
        AND timestamp >= now() - INTERVAL {days:UInt32} DAY
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
    }>(sql, { tenantId, days })
  },

  // ==================== TOP HOSTS ====================
  async getTopHosts(tenantId: string, days: number = 7, limit: number = 10) {
    const sql = `
      SELECT 
        host_name,
        sum(event_count) as count,
        sum(critical_count) as critical,
        sum(high_count) as high
      FROM security_events_top_hosts_mv
      WHERE tenant_id = {tenantId:String}
        AND date >= today() - {days:UInt32}
        AND host_name != ''
      GROUP BY host_name
      ORDER BY count DESC
      LIMIT {limit:UInt32}
    `
    return await query<{
      host_name: string
      count: string
      critical: string
      high: string
    }>(sql, { tenantId, days, limit })
  },

  // ==================== TOP USERS ====================
  async getTopUsers(tenantId: string, days: number = 7, limit: number = 10) {
    const sql = `
      SELECT 
        user_name,
        count() as count,
        countIf(severity = 'critical') as critical,
        countIf(severity = 'high') as high
      FROM security_events
      WHERE tenant_id = {tenantId:String}
        AND timestamp >= now() - INTERVAL {days:UInt32} DAY
        AND user_name != ''
      GROUP BY user_name
      ORDER BY count DESC
      LIMIT {limit:UInt32}
    `
    return await query<{
      user_name: string
      count: string
      critical: string
      high: string
    }>(sql, { tenantId, days, limit })
  },

  // ==================== MITRE HEATMAP ====================
  async getMitreHeatmap(tenantId: string, days: number = 30) {
    const sql = `
      SELECT 
        mitre_tactic,
        mitre_technique,
        sum(event_count) as count
      FROM security_events_mitre_mv
      WHERE tenant_id = {tenantId:String}
        AND date >= today() - {days:UInt32}
        AND (mitre_tactic != '' OR mitre_technique != '')
      GROUP BY mitre_tactic, mitre_technique
      ORDER BY count DESC
    `
    return await query<{
      mitre_tactic: string
      mitre_technique: string
      count: string
    }>(sql, { tenantId, days })
  },

  // ==================== SOURCES BREAKDOWN ====================
  async getSourcesBreakdown(tenantId: string, days: number = 7) {
    const sql = `
      SELECT 
        source,
        sum(event_count) as count
      FROM security_events_daily_mv
      WHERE tenant_id = {tenantId:String}
        AND date >= today() - {days:UInt32}
      GROUP BY source
    `
    return await query<{ source: string; count: string }>(sql, { tenantId, days })
  },

  // ==================== INTEGRATION BREAKDOWN ====================
  async getIntegrationBreakdown(tenantId: string, days: number = 7) {
    const sql = `
      SELECT 
        integration_id,
        integration_name,
        source,
        count() as count,
        countIf(severity = 'critical') as critical,
        countIf(severity = 'high') as high
      FROM security_events
      WHERE tenant_id = {tenantId:String}
        AND timestamp >= now() - INTERVAL {days:UInt32} DAY
        AND integration_id != ''
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
    }>(sql, { tenantId, days })
  },

  // ==================== S1 SITE BREAKDOWN ====================
  async getSiteBreakdown(tenantId: string, days: number = 7) {
    const sql = `
      SELECT 
        host_account_name,
        host_site_name,
        count() as count,
        countIf(severity = 'critical') as critical,
        countIf(severity = 'high') as high
      FROM security_events
      WHERE tenant_id = {tenantId:String}
        AND timestamp >= now() - INTERVAL {days:UInt32} DAY
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
    }>(sql, { tenantId, days })
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
}
