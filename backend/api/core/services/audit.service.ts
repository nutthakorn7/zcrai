import { db } from '../../infra/db';
import { auditLogs } from '../../infra/db/schema';
import { eq, desc, and, gte, lte, sql } from 'drizzle-orm';

export interface AuditEvent {
    tenantId?: string;
    userId?: string;
    action: string;
    resource: string;
    resourceId?: string;
    details?: any;
    ipAddress?: string;
    userAgent?: string;
    status?: 'SUCCESS' | 'FAILURE';
}

export class AuditService {
    
    /**
     * Record an audit log entry
     */
    static async log(event: AuditEvent) {
        try {
            await db.insert(auditLogs).values({
                tenantId: event.tenantId,
                userId: event.userId,
                action: event.action.toUpperCase(),
                resource: event.resource.toLowerCase(),
                resourceId: event.resourceId,
                details: event.details,
                ipAddress: event.ipAddress,
                userAgent: event.userAgent,
                status: event.status || 'SUCCESS'
            });
        } catch (error) {
            console.error("Failed to write audit log:", error);
            // Non-blocking, don't throw to avoid disrupting main flow, 
            // but in strict compliance mode, this might need to alert admins.
        }
    }

    /**
     * List audit logs with advanced filtering and pagination
     */
    static async list(tenantId: string | null | undefined, filters: any = {}) {
        const { userId, action, resource, resourceId, startDate, endDate, limit = 50, offset = 0 } = filters;

        const whereClauses = [];
        if (tenantId) {
            whereClauses.push(eq(auditLogs.tenantId, tenantId));
        }

        if (userId) whereClauses.push(eq(auditLogs.userId, userId));
        if (action) whereClauses.push(eq(auditLogs.action, action.toUpperCase()));
        if (resource) whereClauses.push(eq(auditLogs.resource, resource.toLowerCase()));
        if (resourceId) whereClauses.push(eq(auditLogs.resourceId, resourceId));
        
        if (startDate) {
            whereClauses.push(gte(auditLogs.createdAt, new Date(startDate)));
        }
        if (endDate) {
            const end = new Date(endDate);
            end.setHours(23, 59, 59, 999);
            whereClauses.push(lte(auditLogs.createdAt, end));
        }

        const data = await db.select()
            .from(auditLogs)
            .where(and(...whereClauses))
            .orderBy(desc(auditLogs.createdAt))
            .limit(limit)
            .offset(offset);

        return data;
    }

    /**
     * Get total count of audit logs for pagination
     */
    static async count(tenantId: string | null | undefined, filters: any = {}) {
        const { userId, action, resource, resourceId, startDate, endDate } = filters;

        const whereClauses = [];
        if (tenantId) {
            whereClauses.push(eq(auditLogs.tenantId, tenantId));
        }

        if (userId) whereClauses.push(eq(auditLogs.userId, userId));
        if (action) whereClauses.push(eq(auditLogs.action, action.toUpperCase()));
        if (resource) whereClauses.push(eq(auditLogs.resource, resource.toLowerCase()));
        if (resourceId) whereClauses.push(eq(auditLogs.resourceId, resourceId));
        
        if (startDate) {
            whereClauses.push(gte(auditLogs.createdAt, new Date(startDate)));
        }
        if (endDate) {
            const end = new Date(endDate);
            end.setHours(23, 59, 59, 999);
            whereClauses.push(lte(auditLogs.createdAt, end));
        }

        const [result] = await db.select({ count: sql<number>`count(*)` })
            .from(auditLogs)
            .where(and(...whereClauses));

        return Number(result.count);
    }
}
