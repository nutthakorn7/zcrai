import { Elysia } from 'elysia'
import { jwt } from '@elysiajs/jwt'
import { db } from '../infra/db'
import { auditLogs, users } from '../infra/db/schema'

// JWT Payload Type
interface JWTPayload {
  id: string
  role: string
  tenantId: string
}

// Role Hierarchy
const ROLE_HIERARCHY = {
  superadmin: 4,
  tenant_admin: 3,
  soc_analyst: 2,
  customer: 1,
}

type Role = keyof typeof ROLE_HIERARCHY

// ==================== AUTH GUARD ====================
export const authGuard = new Elysia({ name: 'authGuard' })
  .use(jwt({
    name: 'jwt',
    secret: process.env.JWT_SECRET || 'super_secret_dev_key',
  }))
  .derive(async ({ jwt, cookie: { access_token }, set }: any) => {
    // Debug: Verify this middleware is being executed
    console.log('� [authGuard] derive() called, NODE_ENV:', process.env.NODE_ENV);
    
    //🔓 BYPASS MODE: Auto-inject mock user (skip all auth)
    // Bypass when NOT production, or when explicit bypass flags are set
    const bypassAuth = process.env.NODE_ENV !== 'production' 
                    || process.env.DEV_AUTH_BYPASS === 'true'
                    || process.env.BYPASS_AUTH === 'true';
    
    console.log('🔍 [authGuard] bypassAuth:', bypassAuth);
    if (bypassAuth) {
      console.log('🔓 [authGuard] BYPASS MODE enabled');
      // Fetch actual superadmin from database to get valid tenant ID
      try {
        const { eq } = await import('drizzle-orm');
        const superadmin = await db.query.users.findFirst({
          where: eq(users.role, 'superadmin')
        });
        
        if (superadmin) {
          return {
            user: {
              id: superadmin.id,
              email: superadmin.email,
              role: 'superadmin',
              tenantId: superadmin.tenantId || 'system-admin-tenant'
            } as JWTPayload
          };
        }
      } catch (e) {
        console.error('[Auth] Failed to fetch superadmin for bypass mode:', e);
      }
      
      // Fallback mock user
      return {
        user: {
          id: 'demo-user-id',
          role: 'superadmin',
          tenantId: 'demo-tenant-id'
        } as JWTPayload
      };
    }

    // Production: Normal JWT verification
    if (!access_token?.value) {
      set.status = 401
      throw new Error('Unauthorized')
    }

    const payload = await jwt.verify(access_token.value as string)
    if (!payload) {
      set.status = 401
      throw new Error('Invalid token')
    }
    
    return {
      user: payload as JWTPayload,
    }
  })

// ==================== ROLE GUARD ====================
export const requireRole = (...allowedRoles: Role[]) => {
  return new Elysia({ name: `roleGuard:${allowedRoles.join(',')}` })
    .use(authGuard)
    .onBeforeHandle((ctx: any) => {
      const user = ctx.user as JWTPayload
      const userRole = user.role as Role
      if (!allowedRoles.includes(userRole)) {
        ctx.set.status = 403
        return { error: 'Forbidden: Insufficient permissions' }
      }
    })
}

// ==================== TENANT GUARD ====================
export const tenantGuard = new Elysia({ name: 'tenantGuard' })
  .use(authGuard)
  .derive((ctx: any) => {
    const user = ctx.user as JWTPayload
    return {
      user,
      checkTenantAccess: (resourceTenantId: string) => {
        if (user.role === 'superadmin') return true
        return user.tenantId === resourceTenantId
      },
      tenantId: user.tenantId,
    }
  })

// ==================== AUDIT LOGGER ====================
export const auditLogger = new Elysia({ name: 'auditLogger' })
  .use(authGuard)
  .onAfterResponse(async (ctx: any) => {
    const user = ctx.user as JWTPayload
    try {
      const url = new URL(ctx.request.url)
      await db.insert(auditLogs).values({
        userId: user.id,
        tenantId: user.tenantId,
        action: `${ctx.request.method} ${url.pathname}`,
        resource: url.pathname,
        ipAddress: ctx.request.headers.get('x-forwarded-for') || 'unknown',
        details: {
          method: ctx.request.method,
          path: url.pathname,
          statusCode: ctx.set.status || 200,
        },
      })
    } catch (error) {
      console.error('Audit log error:', error)
    }
  })

// ==================== COMBINED MIDDLEWARE ====================
export const protectedRoute = new Elysia({ name: 'protectedRoute' })
  .use(authGuard)
  .use(tenantGuard)
  .use(auditLogger)

// Helpers
export const superAdminOnly = requireRole('superadmin')
export const tenantAdminOnly = requireRole('superadmin', 'tenant_admin')
export const socAnalystOnly = requireRole('superadmin', 'tenant_admin', 'soc_analyst')
export const anyAuthenticated = requireRole('superadmin', 'tenant_admin', 'soc_analyst', 'customer')
