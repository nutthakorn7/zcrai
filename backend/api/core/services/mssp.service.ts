import { query } from '../../infra/clickhouse/client';
import { db } from '../../infra/db';
import { tenants, apiKeys } from '../../infra/db/schema';
import { count, eq, sql } from 'drizzle-orm';

export class MSSPService {
  /**
   * Get global overview stats across all tenants
   * Optimized using mv_mssp_global_overview
   */
  static async getGlobalOverview() {
    const sqlQuery = `
      SELECT 
        tenant_id,
        sum(total_events) as total_events,
        sum(critical_alerts) as critical_alerts,
        sum(active_hosts) as active_hosts,
        sum(total_gb) as total_gb
      FROM mssp_global_overview
      WHERE date >= now() - INTERVAL 30 DAY
      GROUP BY tenant_id
      ORDER BY critical_alerts DESC
    `;

    const stats = await query<{
      tenant_id: string;
      total_events: string;
      critical_alerts: string;
      active_hosts: string;
      total_gb: string;
    }>(sqlQuery);

    // Join with Tenant metadata from Postgres
    const allTenants = await db.select().from(tenants);
    
    return stats.map(stat => {
        const tenant = allTenants.find(t => t.id === stat.tenant_id);
        return {
            ...stat,
            tenantName: tenant?.name || 'Unknown',
            status: tenant?.status || 'active'
        };
    });
  }

  /**
   * Get health matrix of all integrations across all tenants
   */
  static async getTenantHealthMatrix() {
    const integrations = await db.select({
        tenantId: apiKeys.tenantId,
        provider: apiKeys.provider,
        healthStatus: apiKeys.healthStatus,
        isCircuitOpen: apiKeys.isCircuitOpen
    }).from(apiKeys);

    // Group by tenant
    const matrix: Record<string, any> = {};
    for (const item of integrations) {
        if (!matrix[item.tenantId]) matrix[item.tenantId] = [];
        matrix[item.tenantId].push(item);
    }

    return matrix;
  }

  /**
   * Global IOC Hunt: Search for a value across ALL tenants
   */
  static async globalSearch(value: string) {
    // Uses the new Bloom Filter index on tenant_id + any field matches
    const sqlQuery = `
      SELECT 
        tenant_id,
        count() as match_count,
        min(timestamp) as first_seen,
        max(timestamp) as last_seen
      FROM security_events
      WHERE (
        network_src_ip = {value:String} OR 
        network_dst_ip = {value:String} OR 
        file_sha256 = {value:String} OR
        user_name = {value:String} OR
        host_name = {value:String}
      )
      GROUP BY tenant_id
      ORDER BY match_count DESC
    `;

    return await query(sqlQuery, { value });
  }
}
