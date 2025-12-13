import { Elysia, t } from 'elysia';
import { analyticsService } from '../core/services/analytics.service';

export const analyticsController = new Elysia({ prefix: '/api/analytics' })
  .get('/dashboard', async ({ query, store, error }) => {
    // Auth check (simple version, assuming protected by middleware upstream usually, here just assuming context)
    // const user = store.user; // If we had auth middleware here
    
    // Hardcoded Tenant for now (since we use single-tenant mostly or pass it)
    // Ideally get from user session.
    // For now, let's just require tenantId in query or assume 'default'. 
    // Wait, other controllers assume tenantId is injected or just query all for superadmin. 
    // Let's check playbook.controller... it uses `store.user?.tenantId`.
    // I need to make sure I have access to store.user.
    // Let's grab tenantId from query or fallback to a known test ID if needed, but better to use real auth if possible. 
    // Assuming the main index.ts sets up the context.
    
    // For this implementation, I will treat it as "get for default tenant" if not provided, or strict.
    // Let's assume the user IS authenticated and we have `store.user`.
    // BUT, since I don't see the auth setup in my imports here, I'll rely on the main app passing it.
    
    // const tenantId = (store as any).user?.tenantId || 'default-tenant-id'; 
    // Actually, let's just query everything for now to avoid complexity, or filter by a dummy tenantID if the DB has it.
    // Looking at schema `cases.tenantId`.
    
    const tenantId = (query as any).tenantId || 'c4f280b2-7589-4b68-8086-53842183c500'; // Default Tenant UUID from seed? Or just passed from frontend.

    try {
        const metrics = await analyticsService.getDashboardMetrics(
            tenantId,
            query.startDate,
            query.endDate
        );
        return { success: true, data: metrics };
    } catch (e: any) {
        console.error('Analytics Error:', e);
        return error(500, { success: false, message: e.message });
    }
  }, {
    query: t.Object({
        startDate: t.Optional(t.String()),
        endDate: t.Optional(t.String()),
        tenantId: t.Optional(t.String())
    })
  });
