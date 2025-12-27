import { Elysia, t } from 'elysia'
import { jwt } from '@elysiajs/jwt'
import { AdminService } from '../core/services/admin.service'
import { LogRetentionService } from '../core/services/log-retention.service'
import { MetricsService } from '../core/services/metrics.service'

// Middleware: Check if user is superadmin
const requireSuperAdmin = async (jwt: any, access_token: any) => {
  console.log('[DEBUG_ADMIN] 1. Checking SuperAdmin access');
  if (!access_token?.value) {
    console.log('[DEBUG_ADMIN] No access token value found');
    throw new Error('Unauthorized')
  }
  console.log('[DEBUG_ADMIN] 2. Token found, verifying...');
  const payload = await jwt.verify(access_token.value)
  if (!payload) {
    console.log('[DEBUG_ADMIN] Token verification failed (check secret or expiry)');
    throw new Error('Invalid token')
  }
  console.log(`[DEBUG_ADMIN] 3. Token verified. Role: ${payload.role}`);
  if (payload.role !== 'superadmin') {
    console.log(`[DEBUG_ADMIN] Forbidden. User role is: ${payload.role}`);
    throw new Error('Forbidden: Super Admin access required')
  }
  return payload
}

export const adminController = new Elysia({ prefix: '/admin' })
  .use(
    jwt({
      name: 'jwt',
      secret: process.env.JWT_SECRET || 'super_secret_dev_key',
    })
  )

  /**
   * Check system health status
   * @route GET /admin/health
   * @access SuperAdmin only
   * @returns {Object} System health (database, cache, services)
   */
  .get('/health', async ({ jwt, cookie: { access_token }, set }) => {
    try {
      await requireSuperAdmin(jwt, access_token)
      return await AdminService.checkHealth()
    } catch (e: any) {
      set.status = e.message === 'Forbidden: Super Admin access required' ? 403 : 401
      return { error: e.message }
    }
  })

  /**
   * Get system-wide summary statistics
   * @route GET /admin/summary
   * @access SuperAdmin only
   * @returns {Object} Total tenants, users, events, alerts across all tenants
   */
  .get('/summary', async ({ jwt, cookie: { access_token }, set }) => {
    try {
      await requireSuperAdmin(jwt, access_token)
      return await AdminService.getSystemSummary()
    } catch (e: any) {
      set.status = e.message === 'Forbidden: Super Admin access required' ? 403 : 401
      return { error: e.message }
    }
  })

  /**
   * List all tenants in system
   * @route GET /admin/tenants
   * @access SuperAdmin only
   * @returns {Object} List of all tenants with status
   */
  .get('/tenants', async ({ jwt, cookie: { access_token }, set }) => {
    try {
      await requireSuperAdmin(jwt, access_token)
      return await AdminService.listTenants()
    } catch (e: any) {
      set.status = e.message === 'Forbidden: Super Admin access required' ? 403 : 401
      return { error: e.message }
    }
  })

  // ==================== GET TENANT BY ID ====================
  .get('/tenants/:id', async ({ params, jwt, cookie: { access_token }, set }) => {
    try {
      await requireSuperAdmin(jwt, access_token)
      return await AdminService.getTenantById(params.id)
    } catch (e: any) {
      if (e.message === 'Tenant not found') {
        set.status = 404
      } else if (e.message === 'Forbidden: Super Admin access required') {
        set.status = 403
      } else {
        set.status = 401
      }
      return { error: e.message }
    }
  })

  // ==================== GET TENANT USERS ====================
  .get('/tenants/:id/users', async ({ params, jwt, cookie: { access_token }, set }) => {
    try {
      await requireSuperAdmin(jwt, access_token)
      return await AdminService.getTenantUsers(params.id)
    } catch (e: any) {
      set.status = e.message === 'Forbidden: Super Admin access required' ? 403 : 401
      return { error: e.message }
    }
  })

  // ==================== UPDATE TENANT ====================
  .put('/tenants/:id', async ({ params, body, jwt, cookie: { access_token }, set }) => {
    try {
      await requireSuperAdmin(jwt, access_token)
      const updated = await AdminService.updateTenant(params.id, body as { 
        name?: string; 
        status?: string;
        maxUsers?: number;
        maxEvents?: number;
        maxStorage?: number;
      })
      return { message: 'Tenant updated', tenant: updated }
    } catch (e: any) {
      if (e.message === 'Tenant not found') {
        set.status = 404
      } else if (e.message === 'Forbidden: Super Admin access required') {
        set.status = 403
      } else {
        set.status = 401
      }
      return { error: e.message }
    }
  }, {
    body: t.Object({
      name: t.Optional(t.String()),
      status: t.Optional(t.String()),
      maxUsers: t.Optional(t.Number()),
      maxEvents: t.Optional(t.Number()),
      maxStorage: t.Optional(t.Number())
    })
  })

  // ==================== GET TENANT STATS ====================
  .get('/tenants/:id/stats', async ({ params, query, jwt, cookie: { access_token }, set }) => {
    try {
      await requireSuperAdmin(jwt, access_token)
      const days = query.days ? parseInt(query.days as string) : 7
      return await AdminService.getTenantStats(params.id, days)
    } catch (e: any) {
      set.status = e.message === 'Forbidden: Super Admin access required' ? 403 : 401
      return { error: e.message }
    }
  })

  // ==================== GET TENANT USAGE (Events per Day) ====================
  .get('/tenants/:id/usage', async ({ params, query, jwt, cookie: { access_token }, set }) => {
    try {
      await requireSuperAdmin(jwt, access_token)
      const days = query.days ? parseInt(query.days as string) : 30
      return await AdminService.getTenantUsage(params.id, days)
    } catch (e: any) {
      set.status = e.message === 'Forbidden: Super Admin access required' ? 403 : 401
      return { error: e.message }
    }
  })

  /**
   * Impersonate tenant (view system as specific tenant)
   * @route POST /admin/impersonate/:tenantId
   * @access SuperAdmin only
   * @param {string} tenantId - Tenant ID to impersonate
   * @returns {Object} Success message
   * @description Sets selected_tenant cookie for viewing tenant-specific data
   */
  .post('/impersonate/:tenantId', async ({ params, jwt, cookie: { access_token, selected_tenant }, set }) => {
    try {
      const payload = await requireSuperAdmin(jwt, access_token)
      
      // Verify tenant exists
      await AdminService.getTenantById(params.tenantId)
      
      // Set selected tenant cookie
      selected_tenant.set({
        value: params.tenantId,
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 60 * 60 * 8, // 8 hours
        path: '/'
      })
      
      return { message: 'Now viewing as tenant', tenantId: params.tenantId }
    } catch (e: any) {
      if (e.message === 'Tenant not found') {
        set.status = 404
      } else if (e.message === 'Forbidden: Super Admin access required') {
        set.status = 403
      } else {
        set.status = 401
      }
      return { error: e.message }
    }
  })

  // ==================== CLEAR IMPERSONATION ====================
  .post('/impersonate/clear', async ({ jwt, cookie: { access_token, selected_tenant }, set }) => {
    try {
      await requireSuperAdmin(jwt, access_token)
      selected_tenant.remove()
      return { message: 'Impersonation cleared' }
    } catch (e: any) {
      set.status = e.message === 'Forbidden: Super Admin access required' ? 403 : 401
      return { error: e.message }
    }
  })

  // ==================== LOG RETENTION SETTINGS ====================
  // GET Settings
  .get('/settings/retention', async ({ jwt, cookie: { access_token }, set }) => {
    try {
      await requireSuperAdmin(jwt, access_token)
      // Retrieve current settings
      const auditLogDays = await LogRetentionService.getConfig('retention.audit_logs_days', 90)
      const notificationDays = await LogRetentionService.getConfig('retention.notifications_days', 30)
      const sessionDays = await LogRetentionService.getConfig('retention.sessions_days', 7)

      return { auditLogDays, notificationDays, sessionDays }
    } catch (e: any) {
      set.status = 401
      return { error: e.message }
    }
  })

  // UPDATE Settings
  .put('/settings/retention', async ({ body, jwt, cookie: { access_token }, set }) => {
    try {
      await requireSuperAdmin(jwt, access_token)
      const { auditLogDays, notificationDays, sessionDays } = body as any

      if (auditLogDays) await LogRetentionService.setConfig('retention.audit_logs_days', auditLogDays)
      if (notificationDays) await LogRetentionService.setConfig('retention.notifications_days', notificationDays)
      if (sessionDays) await LogRetentionService.setConfig('retention.sessions_days', sessionDays)

      return { message: 'Retention settings updated' }
    } catch (e: any) {
      set.status = 401
      return { error: e.message }
    }
  }, {
    body: t.Object({
      auditLogDays: t.Optional(t.Number()),
      notificationDays: t.Optional(t.Number()),
      sessionDays: t.Optional(t.Number())
    })
  })

  // TRIGGER CLeanup
  .post('/settings/retention/trigger', async ({ jwt, cookie: { access_token }, set }) => {
    try {
      await requireSuperAdmin(jwt, access_token)
      // Trigger background cleanup
      LogRetentionService.cleanup()
      return { message: 'Cleanup job triggered in background' }
    } catch (e: any) {
      set.status = 401
      return { error: e.message }
    }
  })

  /**
   * Get system license status
   * @route GET /admin/license
   * @access SuperAdmin only
   */
  .get('/license', async ({ jwt, cookie: { access_token }, set }) => {
    try {
      await requireSuperAdmin(jwt, access_token)
      // Mock data for now
      return {
        success: true,
        data: {
          plan: 'Enterprise',
          version: '1.0.0',
          status: 'active',
          expiresAt: '2026-12-31T23:59:59Z',
          maxTenants: 100,
          maxUsers: 1000,
          features: ['sso', 'audit_logs', 'reporting', 'ai_command']
        }
      }
    } catch (e: any) {
      set.status = e.message === 'Forbidden: Super Admin access required' ? 403 : 401
      return { error: e.message }
    }
  })

  /**
   * Update system license key
   * @route POST /admin/license
   * @access SuperAdmin only
   */
  .post('/license', async ({ body, jwt, cookie: { access_token }, set }) => {
    try {
      await requireSuperAdmin(jwt, access_token)
      // Mock validation
      return { success: true, message: 'License updated successfully' }
    } catch (e: any) {
      set.status = e.message === 'Forbidden: Super Admin access required' ? 403 : 401
      return { error: e.message }
    }
  }, {
    body: t.Object({
      key: t.String()
    })
  })

  /**
   * Get system performance metrics
   * @route GET /admin/metrics
   * @access SuperAdmin only
   * @returns {Object} System metrics (CPU, memory, requests/sec)
   */
  .get('/metrics', async ({ jwt, cookie: { access_token }, set }) => {
    try {
      await requireSuperAdmin(jwt, access_token)
      return { success: true, data: MetricsService.getMetrics() }
    } catch (e: any) {
      set.status = e.message === 'Forbidden: Super Admin access required' ? 403 : 401
      return { error: e.message }
    }
  })

