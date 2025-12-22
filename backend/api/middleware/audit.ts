import { Elysia } from 'elysia';
import { AuditService } from '../core/services/audit.service';

export const auditLogger = new Elysia()
    .derive(({ request, store }) => {
        return {
            audit: (action: string, resource: string, details?: any) => {
                // Helper to manually log from controllers
                const user = (store as any).user;
                if (!user) return; // Only audit auth'd actions for now

                AuditService.log({
                    tenantId: user.tenantId,
                    userId: user.id,
                    action,
                    resource,
                    details,
                    ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
                    userAgent: request.headers.get('user-agent') || 'unknown'
                });
            }
        };
    })
    .onAfterHandle(({ request, store, path, response }) => {
        // Auto-log Write operations (POST, PUT, DELETE, PATCH)
        const method = request.method;
        if (method === 'GET' || method === 'OPTIONS' || path.includes('/health')) return;

        const user = (store as any).user;
        if (user) {
            // Heuristic to guess action/resource from path
            // e.g., POST /alerts/123 -> ACTION: POST, RESOURCE: alerts, ID: 123
            const parts = path.split('/').filter(p => p);
            const resource = parts[0] || 'unknown';
            const resourceId = parts[1]; // simplified

            // Don't auto-log if manually handled? 
            // For now, let's log everything to be safe. 
            // If manual logging happened, we might have dupes, but better than missing.
            
            AuditService.log({
                tenantId: user.tenantId,
                userId: user.id,
                action: method,
                resource: resource,
                resourceId: resourceId,
                details: { path, method, statusCode: (response as any)?.status }, 
                ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
                userAgent: request.headers.get('user-agent') || 'unknown',
                status: (response as any)?.status >= 400 ? 'FAILURE' : 'SUCCESS'
            });
        }
    });
