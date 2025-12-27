/**
 * Shared Authentication Middleware
 * 
 * Provides reusable JWT authentication for all controllers.
 * This extends the existing middlewares/auth.middleware.ts with simpler aliases
 */

import { Elysia } from 'elysia';
import { jwt } from '@elysiajs/jwt';

// Re-export from existing middleware for backwards compatibility
export { authGuard, tenantGuard, auditLogger, protectedRoute } from '../middlewares/auth.middleware';
export { requireRole, superAdminOnly, tenantAdminOnly, socAnalystOnly, anyAuthenticated } from '../middlewares/auth.middleware';

import { hasRolePermission, PERMISSIONS } from '../core/access/access-control';
import type { Permission } from '../core/access/access-control';
export { hasRolePermission, PERMISSIONS };
export type { Permission };

// User payload type from JWT
export interface JWTUserPayload {
  userId: string;
  id?: string;
  email: string;
  role: 'user' | 'admin' | 'superadmin' | 'tenant_admin' | 'soc_analyst' | 'customer';
  tenantId: string;
  iat?: number;
  exp?: number;
}

/**
 * JWT configuration used across all controllers
 */
export const jwtConfig = {
  name: 'jwt' as const,
  secret: process.env.JWT_SECRET || 'super_secret_dev_key',
  exp: '1h',
};

/**
 * Simple authentication middleware
 * Use this for basic auth without role requirements
 * 
 * Usage:
 * ```typescript
 * import { withAuth } from '../middleware/auth';
 * 
 * export const myController = new Elysia({ prefix: '/my' })
 *   .use(withAuth)
 *   .get('/', ({ user }) => {
 *     return { userId: user.userId };
 *   })
 * ```
 */
export const withAuth = (app: Elysia) => app
  .use(jwt({
    name: 'jwt',
    secret: process.env.JWT_SECRET || 'super_secret_dev_key',
    exp: '1h',
  }))
  .derive(async ({ jwt, cookie: { access_token }, set }) => {
    // Production: Normal JWT verification
    if (!access_token?.value || typeof access_token.value !== 'string') {
      console.log('[Auth] No access token found');
      return { user: null };
    }

    try {
      const payload = await jwt.verify(access_token.value);
      if (!payload) {
        console.log('[Auth] JWT verification returned null payload');
        return { user: null };
      }
      console.log('[Auth] User authenticated:', payload.email || payload.userId);
      return { user: payload as unknown as JWTUserPayload };
    } catch (e: any) {
      console.error('[Auth] JWT verification failed:', e.message);
      return { user: null };
    }
  })
  .onBeforeHandle(async ({ user, set }: any) => {
    if (!user) {
      set.status = 401;
      throw new Error('Unauthorized: Valid authentication token required');
    }

    // Tenant-aware Rate Limiting
    try {
      const { TenantRateLimitService } = await import('../core/services/tenant-rate-limit.service');
      
      // Map user roles to usage tiers
      let tier: 'free' | 'pro' | 'enterprise' = 'free';
      if (user.role === 'admin' || user.role === 'soc_analyst') tier = 'pro';
      if (user.role === 'superadmin' || user.tenantId === 'system') tier = 'enterprise';

      const status = await TenantRateLimitService.checkLimit(user.tenantId, tier);
      
      if (!status.allowed) {
        set.status = 429;
        set.headers['Retry-After'] = Math.ceil((status.reset - Date.now()) / 1000).toString();
        set.headers['X-RateLimit-Limit'] = status.total.toString();
        set.headers['X-RateLimit-Remaining'] = '0';
        set.headers['X-RateLimit-Reset'] = status.reset.toString();
        
        return { 
          error: 'Too Many Requests', 
          message: 'Tenant API rate limit exceeded. Please try again later or upgrade your plan.',
          resetAt: new Date(status.reset).toISOString()
        };
      }

      // Add rate limit headers to response
      set.headers['X-RateLimit-Limit'] = status.total.toString();
      set.headers['X-RateLimit-Remaining'] = status.remaining.toString();
      set.headers['X-RateLimit-Reset'] = status.reset.toString();
    } catch (e) {
      console.error('[Auth] Rate limiting check failed (failing open):', e);
    }
  });

/**
 * Admin-only authentication middleware
 * Requires user to have 'admin', 'superadmin', or 'tenant_admin' role
 */
export const withAdminAuth = new Elysia({ name: 'admin-auth-middleware' })
  .use(withAuth)
  .onBeforeHandle(({ user, set }: any) => {
    const adminRoles = ['admin', 'superadmin', 'tenant_admin'];
    if (!user || !adminRoles.includes(user.role)) {
      set.status = 403;
      return { error: 'Forbidden', message: 'Admin access required' };
    }
  });

/**
 * Superadmin-only authentication middleware
 * Requires user to have 'superadmin' role
 */
export const withSuperAdminAuth = new Elysia({ name: 'superadmin-auth-middleware' })
  .use(withAuth)
  .onBeforeHandle(({ user, set }: any) => {
    if (!user || user.role !== 'superadmin') {
      set.status = 403;
      return { error: 'Forbidden', message: 'Superadmin access required' };
    }
  });

/**
 * Optional authentication middleware
 * Does not reject unauthenticated requests, but provides user if available
 */
export const withOptionalAuth = new Elysia({ name: 'optional-auth-middleware' })
  .use(jwt(jwtConfig))
  .derive(async ({ jwt, cookie: { access_token } }: any) => {
    if (!access_token?.value || typeof access_token.value !== 'string') {
      return { user: null };
    }
    
    try {
      const payload = await jwt.verify(access_token.value);
      return { user: payload as JWTUserPayload | null };
    } catch {
      return { user: null };
    }
  });

/**
 * Permission-based authorization middleware
 */
export const withPermission = (permission: Permission) => (app: Elysia) => app
  .use(withAuth)
  .onBeforeHandle(({ user, set }: any) => {
    if (!user) {
      set.status = 401;
      throw new Error('Unauthorized: Valid authentication token required');
    }

    if (!hasRolePermission(user.role, permission)) {
      set.status = 403;
      throw new Error(`Forbidden: Missing permission '${permission}'`);
    }
  });
