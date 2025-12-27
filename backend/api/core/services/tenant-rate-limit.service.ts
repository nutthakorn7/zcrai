/**
 * Tenant-aware Rate Limiting Service
 * Protects the system from excessive usage per tenant (Noisy Neighbor protection)
 * Uses Redis for distributed rate limiting
 */

import { redis } from '../../infra/cache/redis';

export interface RateLimitStatus {
  allowed: boolean;
  remaining: number;
  reset: number; // UTC timestamp
  total: number;
}

// Tier-based limits (Requests per Window)
const LIMITS = {
  free: { requests: 100, windowSeconds: 60 },      // 100 RPM
  pro: { requests: 500, windowSeconds: 60 },       // 500 RPM
  enterprise: { requests: 2000, windowSeconds: 60 }, // 2000 RPM
  system: { requests: 10000, windowSeconds: 60 }    // Internal/Back-office
};

export class TenantRateLimitService {
  
  /**
   * Check if a tenant has exceeded their rate limit
   */
  static async checkLimit(tenantId: string, tier: keyof typeof LIMITS = 'free'): Promise<RateLimitStatus> {
    const limit = LIMITS[tier] || LIMITS.free;
    const key = `ratelimit:${tenantId}:${Math.floor(Date.now() / (limit.windowSeconds * 1000))}`;
    
    try {
      // Use Redis INCR for atomic counting
      const current = await redis.incr(key);
      
      if (current === 1) {
        // First request in this window, set expiry
        await redis.expire(key, limit.windowSeconds);
      }
      
      const reset = (Math.floor(Date.now() / (limit.windowSeconds * 1000)) + 1) * limit.windowSeconds * 1000;
      
      return {
        allowed: current <= limit.requests,
        remaining: Math.max(0, limit.requests - current),
        reset,
        total: limit.requests
      };
    } catch (error) {
      console.error(`[TenantRateLimit] Redis error for tenant ${tenantId}:`, error);
      // Fail open to avoid blocking legitimate users if Redis is down
      return {
        allowed: true,
        remaining: 1,
        reset: Date.now() + limit.windowSeconds * 1000,
        total: limit.requests
      };
    }
  }

  /**
   * Get quota usage percentage for a tenant
   */
  static async getUsage(tenantId: string, tier: keyof typeof LIMITS = 'free'): Promise<number> {
    const limit = LIMITS[tier] || LIMITS.free;
    const key = `ratelimit:${tenantId}:${Math.floor(Date.now() / (limit.windowSeconds * 1000))}`;
    
    const current = await redis.get(key);
    if (!current) return 0;
    
    return (parseInt(current) / limit.requests) * 100;
  }
}
