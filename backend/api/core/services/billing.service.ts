import { db } from '../../infra/db'
import { subscriptions, users, tenants } from '../../infra/db/schema'
import { eq, sql, count } from 'drizzle-orm'
import { query } from '../../infra/clickhouse/client'

export const TIERS = {
    free: {
        maxUsers: 5,
        maxRetentionDays: 7,
        maxDataVolumeGB: 5 // 5 GB/Month
    },
    pro: {
        maxUsers: 50,
        maxRetentionDays: 90,
        maxDataVolumeGB: 100 // 100 GB/Month
    },
    enterprise: {
        maxUsers: Infinity,
        maxRetentionDays: 365,
        maxDataVolumeGB: 1000 // 1 TB/Month
    }
}

export type Tier = keyof typeof TIERS;

export const BillingService = {
    async getSubscription(tenantId: string) {
        // 1. Check for Enterprise License (Global)
        const licenseResult = await db.select().from(require('../../infra/db/schema').systemConfig).where(eq(require('../../infra/db/schema').systemConfig.key, 'license_key'))
        const licenseKey = licenseResult[0]?.value

        if (licenseKey) {
             try {
                 const { jwtVerify } = await import('jose')
                 const secret = new TextEncoder().encode(process.env.JWT_SECRET || 'super_secret_dev_key')
                 const { payload } = await jwtVerify(licenseKey, secret)
                 
                 // Check if expired
                 if (Date.now() < (payload.exp as number) * 1000) {
                     return {
                         id: 'enterprise-license',
                         tenantId,
                         tier: 'enterprise',
                         status: 'active',
                         updatedAt: new Date(),
                         limits: {
                             maxUsers: payload.users as number || Infinity,
                             maxRetentionDays: payload.retention as number || 365,
                             maxDataVolumeGB: 10000 // Enterprise defaults
                         }
                     }
                 }
             } catch (e) {
                 // Invalid license, fall through to SaaS subscription
             }
        }

        // 2. Check SaaS Subscription
        const sub = await db.query.subscriptions.findFirst({
            where: eq(subscriptions.tenantId, tenantId)
        })
        
        const tierKey = (sub?.tier as Tier) || 'free'
        
        return {
            ...sub,
            tier: tierKey,
            status: sub?.status || 'active',
            limits: TIERS[tierKey]
        }
    },

    async getCurrentUsage(tenantId: string) {
        // 1. Count Users (Postgres)
        const userResult = await db.select({ count: count() }).from(users).where(eq(users.tenantId, tenantId))
        const userCount = userResult[0].count

        // 2. Calculate Data Volume for current month (ClickHouse)
        // Estimate size based on stored bytes or string length
        const startOfMonth = new Date()
        startOfMonth.setDate(1)
        startOfMonth.setHours(0,0,0,0)
        const startTimestamp = Math.floor(startOfMonth.getTime() / 1000)
        
        const q = `
            SELECT sum(length(toString(*))) as bytes
            FROM security_events
            WHERE tenant_id = {tenantId:String}
            AND timestamp >= toDateTime({start:UInt32})
        `
        // query returns T[]
        const usageResult = await query<{ bytes: string }>(q, {
            tenantId,
            start: startTimestamp
        })

        const bytes = parseInt(usageResult[0]?.bytes || '0')
        const gbUsed = bytes / (1024 * 1024 * 1024)

        return {
            users: userCount,
            dataVolumeGB: gbUsed
        }
    },

    async checkLimit(tenantId: string, resource: 'users' | 'data_volume'): Promise<{ allowed: boolean; current?: number; max?: number }> {
        const sub = await this.getSubscription(tenantId)
        const limits = sub.limits
        const usage = await this.getCurrentUsage(tenantId)

        if (resource === 'users') {
            if (usage.users >= limits.maxUsers) {
                return { allowed: false, current: usage.users, max: limits.maxUsers }
            }
            return { allowed: true, current: usage.users, max: limits.maxUsers }
        }

        if (resource === 'data_volume') {
             if (usage.dataVolumeGB >= limits.maxDataVolumeGB) {
                return { allowed: false, current: usage.dataVolumeGB, max: limits.maxDataVolumeGB }
            }
            return { allowed: true, current: usage.dataVolumeGB, max: limits.maxDataVolumeGB }
        }

        return { allowed: true }
    },

    async subscribe(tenantId: string, tier: Tier) {
        // In a real app, this would integrate with Stripe.
        // Here we just update the DB.
        await db.insert(subscriptions).values({
            tenantId,
            tier,
            status: 'active'
        }).onConflictDoUpdate({
            target: subscriptions.tenantId,
            set: { tier, status: 'active', updatedAt: new Date() }
        })
    }
}
