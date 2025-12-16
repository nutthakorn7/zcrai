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
  .use(jwt(jwtConfig))
  .derive(async ({ jwt, cookie: { access_token } }: any) => {
    if (!access_token?.value || typeof access_token.value !== 'string') {
      return { user: null };
    }
    
    try {
      const payload = await jwt.verify(access_token.value);
      return { user: payload as JWTUserPayload | null };
    } catch (e: any) {
      return { user: null };
    }
  })
  .onBeforeHandle(({ user, set }: any) => {
    if (!user) {
      set.status = 401;
      return { error: 'Unauthorized', message: 'Valid authentication token required' };
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
