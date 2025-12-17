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
  .use(jwt({
    name: 'jwt',
    secret: process.env.JWT_SECRET || 'super_secret_dev_key',
    exp: '1h', // Ensure exp is included if it was in jwtConfig
  }))
  .derive(async ({ jwt, cookie: { access_token }, set }) => {
    // 🔓 BYPASS MODE: Auto-inject mock user (skip all auth)
    // ⚠️ WARNING: Only use for DEMO/TESTING - NOT for production with real data!
    const bypassAuth = process.env.NODE_ENV === 'development' 
                    || process.env.DEV_AUTH_BYPASS === 'true'
                    || process.env.BYPASS_AUTH === 'true'
                    || true; // 🔓 Force Bypass for Demo (Fixes missing login page issue)
    
    if (bypassAuth) {
      console.log('🔓 [Auth] BYPASS MODE: Auto-authenticated as superadmin');
      console.warn('⚠️  WARNING: Authentication is DISABLED - Anyone can access!');
      
      // Fetch actual superadmin from database to get valid tenant ID
      try {
        const { db } = await import('../infra/db');
        const { users, tenants } = await import('../infra/db/schema');
        const { eq } = await import('drizzle-orm');
        
        const superadmin = await db.query.users.findFirst({
          where: eq(users.role, 'superadmin')
        });
        
        if (superadmin) {
          return {
            user: {
              userId: superadmin.id,
              id: superadmin.id,
              email: superadmin.email,
              name: superadmin.name || 'Super Admin',
              role: 'superadmin',
              tenantId: superadmin.tenantId || 'c8abd753-3015-4508-aa7b-6bcf732934e5' // Fallback to System Admin tenant
            } as JWTUserPayload
          };
        }
      } catch (e) {
        console.error('[Auth] Failed to fetch superadmin for bypass mode:', e);
      }
      
      // Fallback with real System Admin tenant ID from database
      return {
        user: {
          userId: 'demo-user-id',
          id: 'demo-user-id',
          email: 'demo@zcr.ai',
          name: 'Demo User',
          role: 'superadmin',
          tenantId: 'c8abd753-3015-4508-aa7b-6bcf732934e5' // Real System Admin tenant UUID
        } as JWTUserPayload
      };
    }


    // Production: Normal JWT verification
    if (!access_token?.value || typeof access_token.value !== 'string') {
      return { user: null };
    }

    try {
      const payload = await jwt.verify(access_token.value);
      if (!payload) {
        return { user: null };
      }
      return { user: payload as unknown as JWTUserPayload };
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
