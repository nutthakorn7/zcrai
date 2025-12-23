import { redis } from '../../infra/cache/redis'

/**
 * Dashboard Cache Service
 * Provides caching layer for dashboard queries with TTL management
 */

type CacheKey = 
  | 'dashboard:summary'
  | 'dashboard:timeline'
  | 'dashboard:mitre'
  | 'dashboard:top-hosts'
  | 'dashboard:top-users'
  | 'dashboard:sources'
  | 'dashboard:integrations'
  | 'dashboard:sites'
  | 'dashboard:recent'
  | 'dashboard:ai-metrics'
  | 'dashboard:feedback-metrics'
  | 'dashboard:performance'

interface CacheConfig {
  ttl: number // seconds
}

const CACHE_CONFIG: Record<CacheKey, CacheConfig> = {
  'dashboard:summary': { ttl: 30 },        // 30s - frequently updated
  'dashboard:timeline': { ttl: 60 },       // 1min
  'dashboard:mitre': { ttl: 300 },         // 5min - slower changing
  'dashboard:top-hosts': { ttl: 60 },      // 1min
  'dashboard:top-users': { ttl: 60 },      // 1min
  'dashboard:sources': { ttl: 60 },        // 1min
  'dashboard:integrations': { ttl: 120 },  // 2min
  'dashboard:sites': { ttl: 120 },         // 2min
  'dashboard:recent': { ttl: 30 },         // 30s - realtime data
  'dashboard:ai-metrics': { ttl: 300 },    // 5min
  'dashboard:feedback-metrics': { ttl: 60 }, // 1min
  'dashboard:performance': { ttl: 300 },   // 5min
}

/**
 * Build cache key with tenant and date range
 */
function buildCacheKey(
  type: CacheKey,
  tenantId: string,
  startDate?: string,
  endDate?: string,
  extra?: Record<string, any>
): string {
  const parts = [type, tenantId]
  
  if (startDate && endDate) {
    // Normalize dates to day-level for better cache hits
    const start = startDate.split('T')[0]
    const end = endDate.split('T')[0]
    parts.push(start, end)
  }
  
  if (extra) {
    // Add sorted extra params for consistent keys
    const sorted = Object.keys(extra).sort()
    for (const key of sorted) {
      parts.push(`${key}:${extra[key]}`)
    }
  }
  
  return parts.join(':')
}

/**
 * Get cached data or execute function and cache result
 */
export async function cached<T>(
  type: CacheKey,
  tenantId: string,
  fn: () => Promise<T>,
  options?: {
    startDate?: string
    endDate?: string
    extra?: Record<string, any>
    ttl?: number // Override default TTL
  }
): Promise<T> {
  const cacheKey = buildCacheKey(type, tenantId, options?.startDate, options?.endDate, options?.extra)
  
  try {
    // Try to get from cache
    const cached = await redis.get(cacheKey)
    if (cached) {
      console.log(`[DashboardCache] HIT: ${cacheKey}`)
      return JSON.parse(cached) as T
    }
    
    console.log(`[DashboardCache] MISS: ${cacheKey}`)
  } catch (error) {
    console.error(`[DashboardCache] Error reading cache:`, error)
    // Continue to fetch fresh data
  }
  
  // Execute function to get fresh data
  const result = await fn()
  
  // Cache the result
  try {
    const ttl = options?.ttl || CACHE_CONFIG[type].ttl
    await redis.setex(cacheKey, ttl, JSON.stringify(result))
    console.log(`[DashboardCache] SET: ${cacheKey} (TTL: ${ttl}s)`)
  } catch (error) {
    console.error(`[DashboardCache] Error writing cache:`, error)
    // Don't fail the request if caching fails
  }
  
  return result
}

/**
 * Invalidate cache for a tenant (use when data is updated)
 */
export async function invalidateDashboardCache(tenantId: string, type?: CacheKey) {
  try {
    if (type) {
      // Invalidate specific type
      const pattern = `${type}:${tenantId}:*`
      const keys = await redis.keys(pattern)
      if (keys.length > 0) {
        await redis.del(...keys)
        console.log(`[DashboardCache] INVALIDATED ${keys.length} keys matching ${pattern}`)
      }
    } else {
      // Invalidate all dashboard caches for tenant
      const pattern = `dashboard:*:${tenantId}:*`
      const keys = await redis.keys(pattern)
      if (keys.length > 0) {
        await redis.del(...keys)
        console.log(`[DashboardCache] INVALIDATED ALL (${keys.length} keys) for tenant ${tenantId}`)
      }
    }
  } catch (error) {
    console.error(`[DashboardCache] Error invalidating cache:`, error)
  }
}

/**
 * Get cache statistics
 */
export async function getCacheStats() {
  try {
    const dashboardKeys = await redis.keys('dashboard:*')
    const info = await redis.info('stats')
    
    // Parse Redis stats
    const stats: Record<string, any> = {}
    info.split('\r\n').forEach(line => {
      const [key, value] = line.split(':')
      if (key && value) {
        stats[key] = value
      }
    })
    
    return {
      totalKeys: dashboardKeys.length,
      keyspaceHits: parseInt(stats.keyspace_hits || '0'),
      keyspaceMisses: parseInt(stats.keyspace_misses || '0'),
      hitRate: stats.keyspace_hits && stats.keyspace_misses
        ? (parseInt(stats.keyspace_hits) / (parseInt(stats.keyspace_hits) + parseInt(stats.keyspace_misses)) * 100).toFixed(2) + '%'
        : 'N/A'
    }
  } catch (error) {
    console.error('[DashboardCache] Error getting stats:', error)
    return null
  }
}
