import { db } from '../../infra/db';
import { auditLogs } from '../../infra/db/schema';

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
}
