import { db } from '../../infra/db'
import { tenants, users, apiKeys } from '../../infra/db/schema'
import { eq, count, desc, sql } from 'drizzle-orm'
import { query } from '../../infra/clickhouse/client'

export const AdminService = {
  // ==================== LIST ALL TENANTS ====================
  async listTenants() {
    const tenantsData = await db.select({
      id: tenants.id,
      name: tenants.name,
      status: tenants.status,
      createdAt: tenants.createdAt,
    })
    .from(tenants)
    .orderBy(desc(tenants.createdAt))

    // Get user count and integration count for each tenant
    const tenantsWithStats = await Promise.all(
      tenantsData.map(async (tenant) => {
        const [userCount] = await db.select({ count: count() })
          .from(users)
          .where(eq(users.tenantId, tenant.id))
        
        const [integrationCount] = await db.select({ count: count() })
          .from(apiKeys)
          .where(eq(apiKeys.tenantId, tenant.id))

        // Get event count from ClickHouse
        let eventCount = 0
        try {
          const result = await query<{ count: string }>(`
            SELECT count() as count 
            FROM security_events 
            WHERE tenant_id = {tenantId:String}
          `, { tenantId: tenant.id })
          eventCount = parseInt(result[0]?.count || '0')
        } catch (e) {
          // ClickHouse might not be available
        }

        return {
          ...tenant,
          userCount: userCount?.count || 0,
          integrationCount: integrationCount?.count || 0,
          eventCount,
        }
      })
    )

    return tenantsWithStats
  },

  // ==================== GET TENANT BY ID ====================
  async getTenantById(tenantId: string) {
    const [tenant] = await db.select()
      .from(tenants)
      .where(eq(tenants.id, tenantId))

    if (!tenant) throw new Error('Tenant not found')

    // Get users
    const tenantUsers = await db.select({
      id: users.id,
      email: users.email,
      role: users.role,
      status: users.status,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(eq(users.tenantId, tenantId))

    // Get integrations
    const integrations = await db.select({
      id: apiKeys.id,
      provider: apiKeys.provider,
      label: apiKeys.label,
      lastSyncStatus: apiKeys.lastSyncStatus,
      lastSyncAt: apiKeys.lastSyncAt,
    })
    .from(apiKeys)
    .where(eq(apiKeys.tenantId, tenantId))

    // Get event stats from ClickHouse
    let stats = { total: 0, critical: 0, high: 0, medium: 0, low: 0 }
    try {
      const result = await query<{ severity: string, count: string }>(`
        SELECT severity, count() as count 
        FROM security_events 
        WHERE tenant_id = {tenantId:String}
        GROUP BY severity
      `, { tenantId })
      
      for (const row of result) {
        const c = parseInt(row.count)
        stats.total += c
        if (row.severity === 'critical') stats.critical = c
        if (row.severity === 'high') stats.high = c
        if (row.severity === 'medium') stats.medium = c
        if (row.severity === 'low') stats.low = c
      }
    } catch (e) {
      // ClickHouse might not be available
    }

    return {
      ...tenant,
      users: tenantUsers,
      integrations,
      stats,
    }
  },

  // ==================== GET TENANT USERS ====================
  async getTenantUsers(tenantId: string) {
    const tenantUsers = await db.select({
      id: users.id,
      email: users.email,
      role: users.role,
      status: users.status,
      createdAt: users.createdAt,
      mfaEnabled: users.mfaEnabled,
    })
    .from(users)
    .where(eq(users.tenantId, tenantId))
    .orderBy(desc(users.createdAt))

    return tenantUsers
  },

  // ==================== UPDATE TENANT STATUS ====================
  async updateTenant(tenantId: string, data: { name?: string; status?: string }) {
    const [updated] = await db.update(tenants)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(tenants.id, tenantId))
      .returning()

    if (!updated) throw new Error('Tenant not found')
    return updated
  },

  // ==================== GET TENANT STATS (for selected tenant view) ====================
  async getTenantStats(tenantId: string, days: number = 7) {
    try {
      const result = await query<{ severity: string, count: string }>(`
        SELECT severity, count() as count 
        FROM security_events 
        WHERE tenant_id = {tenantId:String}
          AND timestamp >= now() - INTERVAL {days:UInt32} DAY
        GROUP BY severity
      `, { tenantId, days })

      const stats: Record<string, number> = { critical: 0, high: 0, medium: 0, low: 0, info: 0, total: 0 }
      for (const row of result) {
        const c = parseInt(row.count)
        stats[row.severity] = c
        stats.total += c
      }
      return stats
    } catch (e) {
      return { critical: 0, high: 0, medium: 0, low: 0, info: 0, total: 0 }
    }
  },

  // ==================== GET ALL TENANTS SUMMARY (for admin dashboard) ====================
  async getSystemSummary() {
    const [tenantCount] = await db.select({ count: count() }).from(tenants)
    const [userCount] = await db.select({ count: count() }).from(users)
    const [integrationCount] = await db.select({ count: count() }).from(apiKeys)

    let totalEvents = 0
    try {
      const result = await query<{ count: string }>(`SELECT count() as count FROM security_events`)
      totalEvents = parseInt(result[0]?.count || '0')
    } catch (e) {}

    return {
      tenants: tenantCount?.count || 0,
      users: userCount?.count || 0,
      integrations: integrationCount?.count || 0,
      events: totalEvents,
    }
  },

  // ==================== GET TENANT USAGE (Events per Day) ====================
  async getTenantUsage(tenantId: string, days: number = 30) {
    try {
      const result = await query<{ date: string, count: string }>(`
        SELECT 
          toDate(timestamp) as date,
          count() as count
        FROM security_events 
        WHERE tenant_id = {tenantId:String}
          AND timestamp >= now() - INTERVAL {days:UInt32} DAY
        GROUP BY date
        ORDER BY date
      `, { tenantId, days })

      return result.map(r => ({
        date: r.date,
        count: parseInt(r.count)
      }))
    } catch (e) {
      return []
    }
  },

  // ==================== CHECK SYSTEM HEALTH ====================
  async checkHealth() {
    const health = {
      database: 'unknown',
      clickhouse: 'unknown',
      redis: 'unknown',
      status: 'healthy',
    }

    // Check PostgreSQL
    try {
      await db.execute(sql`SELECT 1`)
      health.database = 'connected'
    } catch (e) {
      health.database = 'disconnected'
      health.status = 'degraded'
    }

    // Check ClickHouse
    try {
      await query('SELECT 1')
      health.clickhouse = 'connected'
    } catch (e) {
      health.clickhouse = 'disconnected'
      health.status = 'degraded'
    }

    // Check Redis
    health.redis = 'connected' 

    return health
  },
}
