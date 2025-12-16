import { query } from '../../infra/clickhouse/client'

export interface RetroScanResult {
    found: boolean;
    count: number;
    matches: any[];
}

export const RetroScanService = {
  async scan(tenantId: string, type: 'ip' | 'hash' | 'domain', value: string, days: number = 90): Promise<RetroScanResult> {
    const conditions: string[] = ['tenant_id = {tenantId:String}']
    const params: Record<string, any> = { tenantId, value, days }

    // Time range
    conditions.push("timestamp >= now() - INTERVAL {days:UInt32} DAY")

    // IOC Logic
    if (type === 'ip') {
        conditions.push(`(
            host_ip = {value:String} OR 
            host_external_ip = {value:String} OR 
            network_src_ip = {value:String} OR 
            network_dst_ip = {value:String}
        )`)
    } else if (type === 'hash') {
        conditions.push(`(
            file_hash = {value:String} OR 
            file_sha256 = {value:String} OR 
            file_md5 = {value:String} OR 
            process_sha256 = {value:String} OR 
            process_md5 = {value:String} OR
            parent_process_sha256 = {value:String} OR
            parent_process_md5 = {value:String}
        )`)
    } else if (type === 'domain') {
        conditions.push(`(
            host_domain = {value:String} OR 
            user_domain = {value:String}
        )`)
    }

    const whereClause = conditions.join(' AND ')

    const sql = `
        SELECT *
        FROM security_events FINAL
        WHERE ${whereClause}
        ORDER BY timestamp DESC
        LIMIT 100
    `

    const matches = await query<any>(sql, params)

    return {
        found: matches.length > 0,
        count: matches.length,
        matches
    }
  }
}
