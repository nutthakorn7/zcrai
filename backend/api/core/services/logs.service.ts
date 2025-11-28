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
      params.startDate = filters.startDate
    }
    if (filters.endDate) {
      conditions.push('timestamp <= {endDate:DateTime64}')
      params.endDate = filters.endDate
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

    const whereClause = conditions.join(' AND ')
    const orderClause = `${sortBy} ${sortOrder.toUpperCase()}`

    // Query data
    const dataSql = `
      SELECT 
        id, source, timestamp, severity, event_type, title, description,
        host_name, host_ip, user_name, mitre_tactic, mitre_technique,
        process_name, file_name
      FROM security_events FINAL
      WHERE ${whereClause}
      ORDER BY ${orderClause}
      LIMIT {limit:UInt32}
      OFFSET {offset:UInt32}
    `

    // Query total count
    const countSql = `
      SELECT count() as total
      FROM security_events FINAL
      WHERE ${whereClause}
    `

    const [data, countResult] = await Promise.all([
      query<any>(dataSql, params),
      queryOne<{ total: string }>(countSql, params),
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
    }
  },

  // ==================== GET SINGLE LOG ====================
  async getById(tenantId: string, id: string) {
    const sql = `
      SELECT *
      FROM security_events FINAL
      WHERE tenant_id = {tenantId:String} AND id = {id:String}
      LIMIT 1
    `
    return await queryOne<any>(sql, { tenantId, id })
  },

  // ==================== GET DISTINCT VALUES (for filters) ====================
  async getFilterOptions(tenantId: string) {
    const [severities, sources, eventTypes] = await Promise.all([
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
    ])

    return {
      severities: severities.map(r => r.severity),
      sources: sources.map(r => r.source),
      eventTypes: eventTypes.map(r => r.event_type),
    }
  },
}
