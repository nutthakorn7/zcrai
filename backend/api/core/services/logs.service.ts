import { query, queryOne } from '../../infra/clickhouse/client'

export interface LogFilters {
  startDate?: string
  endDate?: string
  severity?: string[]
  source?: string[]
  host?: string
  user?: string
  search?: string
  eventType?: string
  integrationId?: string
  accountName?: string
  siteName?: string
  technique?: string
}

export interface PaginationParams {
  page: number
  limit: number
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
}

export const LogsService = {
  // ==================== LIST LOGS (Paginated) ====================
  async list(tenantId: string, filters: LogFilters, pagination: PaginationParams) {
    const { page, limit, sortBy = 'timestamp', sortOrder = 'desc' } = pagination
    const offset = (page - 1) * limit

    // สร้าง WHERE conditions
    const conditions: string[] = ['tenant_id = {tenantId:String}']
    const params: Record<string, any> = { tenantId, limit, offset }

    if (filters.startDate) {
      conditions.push('timestamp >= {startDate:DateTime64}')
      params.startDate = filters.startDate.replace('T', ' ').replace('Z', '')
    }
    if (filters.endDate) {
      conditions.push('timestamp <= {endDate:DateTime64}')
      params.endDate = filters.endDate.replace('T', ' ').replace('Z', '')
    }
    if (filters.severity?.length) {
      conditions.push(`severity IN ({severity:Array(String)})`)
      params.severity = filters.severity
    }
    if (filters.source?.length) {
      conditions.push(`source IN ({source:Array(String)})`)
      params.source = filters.source
    }
    if (filters.host) {
      conditions.push('host_name ILIKE {host:String}')
      params.host = `%${filters.host}%`
    }
    if (filters.user) {
      conditions.push('user_name ILIKE {user:String}')
      params.user = `%${filters.user}%`
    }
    if (filters.eventType) {
      conditions.push('event_type = {eventType:String}')
      params.eventType = filters.eventType
    }
    if (filters.search) {
      conditions.push('(title ILIKE {search:String} OR description ILIKE {search:String})')
      params.search = `%${filters.search}%`
    }
    // New filters for Integration and S1 Tenant
    if (filters.integrationId) {
      conditions.push('integration_id = {integrationId:String}')
      params.integrationId = filters.integrationId
    }
    if (filters.accountName) {
      conditions.push('host_account_name = {accountName:String}')
      params.accountName = filters.accountName
    }
    if (filters.siteName) {
      conditions.push('host_site_name = {siteName:String}')
      params.siteName = filters.siteName
    }
    if (filters.technique) {
      conditions.push('mitre_technique = {technique:String}')
      params.technique = filters.technique
    }

    const whereClause = conditions.join(' AND ')
    const orderClause = `${sortBy} ${sortOrder.toUpperCase()}`

    // Query data - use only columns that exist in the ClickHouse table
    const dataSql = `
      SELECT 
        id, source, timestamp, severity, event_type,
        host_name, host_ip, user_name, mitre_tactic, mitre_technique,
        process_name, file_name,
        integration_id, integration_name,
        host_site_name, host_account_name,
        CASE
          WHEN event_type != '' THEN event_type
          ELSE 'System Event'
        END as title
      FROM security_events
      WHERE ${whereClause}
      ORDER BY ${orderClause}
      LIMIT {limit:UInt32}
      OFFSET {offset:UInt32}
    `

    // Query total count
    const countSql = `
      SELECT count() as total
      FROM security_events
      WHERE ${whereClause}
    `

    const [data, countResult, topSources, topHosts, topUsers] = await Promise.all([
      query<any>(dataSql, params),
      queryOne<{ total: string }>(countSql, params),
      query<{name: string, count: string}>(`SELECT source as name, count() as count FROM security_events WHERE ${whereClause} GROUP BY source ORDER BY count DESC LIMIT 5`, params),
      query<{name: string, count: string}>(`SELECT host_name as name, count() as count FROM security_events WHERE ${whereClause} AND host_name != '' GROUP BY host_name ORDER BY count DESC LIMIT 5`, params),
      query<{name: string, count: string}>(`SELECT user_name as name, count() as count FROM security_events WHERE ${whereClause} AND user_name != '' GROUP BY user_name ORDER BY count DESC LIMIT 5`, params)
    ])

    const total = parseInt(countResult?.total || '0')

    return {
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      facets: {
        sources: topSources.map(r => ({ name: r.name, count: parseInt(r.count) })),
        hosts: topHosts.map(r => ({ name: r.name, count: parseInt(r.count) })),
        users: topUsers.map(r => ({ name: r.name, count: parseInt(r.count) })),
      }
    }
  },

  // ==================== GET SINGLE LOG ====================
  async getById(tenantId: string, id: string) {
    const sql = `
      SELECT *
      FROM security_events
      WHERE tenant_id = {tenantId:String} AND id = {id:String}
      LIMIT 1
    `
    return await queryOne<any>(sql, { tenantId, id })
  },

  // ==================== GET FILTER OPTIONS (Integrations, Accounts, Sites) ====================
  async getFilterOptions(tenantId: string) {
    const [severities, sources, eventTypes, integrations, accounts, sites] = await Promise.all([
      query<{ severity: string }>(`
        SELECT DISTINCT severity 
        FROM security_events 
        WHERE tenant_id = {tenantId:String} AND severity != ''
      `, { tenantId }),
      query<{ source: string }>(`
        SELECT DISTINCT source 
        FROM security_events 
        WHERE tenant_id = {tenantId:String}
      `, { tenantId }),
      query<{ event_type: string }>(`
        SELECT DISTINCT event_type 
        FROM security_events 
        WHERE tenant_id = {tenantId:String} AND event_type != ''
      `, { tenantId }),
      // Integrations - รายการ Integration ทั้งหมดที่มีข้อมูล
      query<{ integration_id: string; integration_name: string }>(`
        SELECT DISTINCT integration_id, integration_name 
        FROM security_events 
        WHERE tenant_id = {tenantId:String} AND integration_id != ''
        ORDER BY integration_name
      `, { tenantId }),
      // Accounts - รายการ Account ทั้งหมด (รองรับทุก source)
      query<{ host_account_id: string; host_account_name: string }>(`
        SELECT DISTINCT host_account_id, host_account_name 
        FROM security_events 
        WHERE tenant_id = {tenantId:String} AND host_account_name != ''
        ORDER BY host_account_name
      `, { tenantId }),
      // Sites - รายการ Site ทั้งหมด (รองรับทุก source)
      query<{ host_site_id: string; host_site_name: string }>(`
        SELECT DISTINCT host_site_id, host_site_name 
        FROM security_events 
        WHERE tenant_id = {tenantId:String} AND host_site_name != ''
        ORDER BY host_site_name
      `, { tenantId }),
    ])

    return {
      severities: severities.map(r => r.severity),
      sources: sources.map(r => r.source),
      eventTypes: eventTypes.map(r => r.event_type),
      integrations: integrations.map(r => ({ id: r.integration_id, name: r.integration_name })),
      accounts: accounts.map(r => ({ id: r.host_account_id, name: r.host_account_name })),
      sites: sites.map(r => ({ id: r.host_site_id, name: r.host_site_name })),
    }
  },
  // ==================== GET HISTOGRAM ====================
  async getHistogram(tenantId: string, filters: LogFilters, intervalSeconds: number) {
    const conditions: string[] = ['tenant_id = {tenantId:String}']
    const params: Record<string, any> = { tenantId, intervalSeconds }

    if (filters.startDate) {
      conditions.push('timestamp >= {startDate:DateTime64}')
      params.startDate = filters.startDate.replace('T', ' ').replace('Z', '')
    }
    if (filters.endDate) {
      conditions.push('timestamp <= {endDate:DateTime64}')
      params.endDate = filters.endDate.replace('T', ' ').replace('Z', '')
    }
    if (filters.severity?.length) {
      conditions.push(`severity IN ({severity:Array(String)})`)
      params.severity = filters.severity
    }
    if (filters.source?.length) {
      conditions.push(`source IN ({source:Array(String)})`)
      params.source = filters.source
    }
    if (filters.host) {
      conditions.push('host_name ILIKE {host:String}')
      params.host = `%${filters.host}%`
    }
    if (filters.user) {
      conditions.push('user_name ILIKE {user:String}')
      params.user = `%${filters.user}%`
    }
    if (filters.eventType) {
      conditions.push('event_type = {eventType:String}')
      params.eventType = filters.eventType
    }
    if (filters.search) {
      conditions.push('(title ILIKE {search:String} OR description ILIKE {search:String})')
      params.search = `%${filters.search}%`
    }
    if (filters.integrationId) {
      conditions.push('integration_id = {integrationId:String}')
      params.integrationId = filters.integrationId
    }
    if (filters.accountName) {
      conditions.push('host_account_name = {accountName:String}')
      params.accountName = filters.accountName
    }
    if (filters.siteName) {
      conditions.push('host_site_name = {siteName:String}')
      params.siteName = filters.siteName
    }
    if (filters.technique) {
      conditions.push('mitre_technique = {technique:String}')
      params.technique = filters.technique
    }

    const whereClause = conditions.join(' AND ')

    const sql = `
      SELECT
        toStartOfInterval(timestamp, INTERVAL {intervalSeconds:UInt32} SECOND) as time,
        count() as count,
        countIf(severity = 'critical') as critical_count
      FROM security_events
      WHERE ${whereClause}
      GROUP BY time
      ORDER BY time
    `
    return await query<{ time: string; count: number; critical_count: number }>(sql, params)
  },
}
