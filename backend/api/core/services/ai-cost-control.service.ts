/**
 * AI Cost Control Service
 * Tracks and enforces Gemini token usage per tenant
 */

import { db } from '../../infra/db';
import { tenants } from '../../infra/db/schema';
import { eq, sql } from 'drizzle-orm';
import { redis } from '../../infra/cache/redis';

export interface UsageReport {
  tokens: {
    promptTokens: number;
    candidatesTokens: number;
    totalTokens: number;
  };
}

export class AICostControlService {
  // Mapping: 1,000 tokens = 1 Credit
  private static CREDIT_RATIO = 1000;

  /**
   * Record token usage for a tenant
   */
  static async recordUsage(tenantId: string, usage: UsageReport): Promise<void> {
    const tokens = usage.tokens.totalTokens;
    if (tokens <= 0) return;

    try {
      // 1. Update Persistent DB (Total Usage)
      await db.update(tenants)
        .set({
          apiUsage: sql`${tenants.apiUsage} + ${tokens}`,
          updatedAt: new Date()
        })
        .where(eq(tenants.id, tenantId));

      // 2. Update Redis Daily Counter
      const today = new Date().toISOString().split('T')[0];
      const dailyKey = `usage:daily:${tenantId}:${today}`;
      
      await redis.incrby(dailyKey, tokens);
      await redis.expire(dailyKey, 86400 * 2); // Keep for 2 days

      console.log(`[CostControl] Recorded ${tokens} tokens for tenant ${tenantId}`);
    } catch (error) {
      console.error(`[CostControl] Failed to record usage for tenant ${tenantId}:`, error);
    }
  }

  /**
   * Check if a tenant has remaining budget
   */
  static async checkBudget(tenantId: string): Promise<{ 
    allowed: boolean; 
    usage: number; 
    limit: number;
    remaining: number;
  }> {
    try {
      const [tenant] = await db.select({
        apiUsage: tenants.apiUsage,
        apiLimit: tenants.apiLimit
      })
      .from(tenants)
      .where(eq(tenants.id, tenantId));

      if (!tenant) throw new Error('Tenant not found');

      const allowed = tenant.apiUsage < tenant.apiLimit;
      
      return {
        allowed,
        usage: tenant.apiUsage,
        limit: tenant.apiLimit,
        remaining: Math.max(0, tenant.apiLimit - tenant.apiUsage)
      };
    } catch (error) {
      console.error(`[CostControl] Budget check failed for tenant ${tenantId}:`, error);
      // Fail open to avoid blocking (unless strict mode requested)
      return { allowed: true, usage: 0, limit: 1000000, remaining: 1000000 };
    }
  }

  /**
   * Get detailed usage stats for a tenant
   */
  static async getUsageStats(tenantId: string): Promise<any> {
    const budget = await this.checkBudget(tenantId);
    
    // Get last 7 days from Redis
    const stats = [];
    for (let i = 0; i < 7; i++) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dayStr = date.toISOString().split('T')[0];
        const val = await redis.get(`usage:daily:${tenantId}:${dayStr}`);
        stats.push({ date: dayStr, tokens: parseInt(val || '0') });
    }

    return {
      ...budget,
      history: stats.reverse()
    };
  }
}
