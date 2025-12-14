import { Elysia } from 'elysia'
import { jwt } from '@elysiajs/jwt'
import { db } from '../infra/db'
import { auditLogs } from '../infra/db/schema'

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
  .derive(async ({ jwt, cookie: { access_token }, set }) => {
    if (!access_token.value) {
      set.status = 401
      throw new Error('Unauthorized')
    }

    const payload = await jwt.verify(access_token.value)
    if (!payload) {
      set.status = 401
      throw new Error('Invalid token')
    }
    // console.log('AUTH GUARD PAYLOAD:', payload); 

    return {
      user: payload as unknown as JWTPayload,
    }
  })

// ==================== ROLE GUARD ====================
export const requireRole = (...allowedRoles: Role[]) => {
  return new Elysia({ name: `roleGuard:${allowedRoles.join(',')}` })
    .use(authGuard)
    .onBeforeHandle(({ user, set }) => {
      const userRole = user.role as Role
      if (!allowedRoles.includes(userRole)) {
        set.status = 403
        return { error: 'Forbidden: Insufficient permissions' }
      }
    })
}

// ==================== TENANT GUARD ====================
export const tenantGuard = new Elysia({ name: 'tenantGuard' })
  .use(authGuard)
  .derive(({ user }) => {
    return {
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
  .onAfterResponse(async ({ user, request, set }) => {
    try {
      const url = new URL(request.url)
      await db.insert(auditLogs).values({
        userId: user.id,
        tenantId: user.tenantId,
        action: `${request.method} ${url.pathname}`,
        resource: url.pathname,
        ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
        details: {
          method: request.method,
          path: url.pathname,
          statusCode: set.status || 200,
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
