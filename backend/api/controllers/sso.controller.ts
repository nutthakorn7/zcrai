import { Elysia, t } from 'elysia'
import { jwt } from '@elysiajs/jwt'
import { SSOService } from '../core/services/sso.service'
import { AuthService } from '../core/services/auth.service'

export const ssoController = new Elysia({ prefix: '/auth/sso' })
  // Public Routes (uses ssoJwt for signing tokens in callback)
  .use(
    jwt({
        name: 'ssoJwt',
        secret: process.env.JWT_SECRET || 'super_secret_dev_key',
        exp: process.env.JWT_ACCESS_EXPIRY || '7d'
    })
  )
  .get('/login', async ({ query, set, redirect }) => {
    try {
        const { provider, tenantId } = query;
        if (!provider || !tenantId) throw new Error('Missing provider or tenantId');
        
        const url = await SSOService.getAuthorizationUrl(tenantId, provider);
        return redirect(url);
    } catch (e: any) {
        set.status = 400;
        return { error: e.message };
    }
  }, {
      query: t.Object({
          provider: t.String(),
          tenantId: t.String()
      })
  })
  .get('/callback', async ({ request, query, ssoJwt, set, cookie: { access_token, refresh_token }, redirect }) => {
     try {
         const currentUrl = new URL(request.url);
         const state = query.state;
         if (!state) throw new Error('Missing state (tenantId)');
         
         const result = await SSOService.handleCallback(state, 'google', currentUrl);
         
         const email = result.claims?.email as string;
         if (!email) throw new Error('No email provided by IDP');
         
         let user = await AuthService.getUserByEmail(email);
         if (!user) {
             throw new Error('User not found. Please register first.');
         }
         
         // Sign token including tenantId
         const accessToken = await ssoJwt.sign({
             sub: user.id,
             role: user.role,
             tenantId: user.tenantId
         });

         const userAgent = request.headers.get('user-agent') || undefined;
         const refreshTokenValue = await AuthService.createRefreshToken(user.id, userAgent);

         access_token.set({
            value: accessToken,
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 7 * 24 * 60 * 60,
            path: '/'
         });

         refresh_token.set({
            value: refreshTokenValue,
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 7 * 24 * 60 * 60,
            path: '/auth/refresh'
         });
         
         return redirect('/dashboard');
     } catch (e: any) {
         set.status = 400;
         return { error: e.message };
     }
  })
  
  // ==================== PROTECTED SETTINGS ROUTES ====================
  // Manual verification to bypass middleware issues
  .get('/config', async ({ ssoJwt, cookie: { access_token }, set }) => {
      try {
          if (!access_token.value) {
              set.status = 401;
              return { error: 'Unauthorized' };
          }
          const payload = await ssoJwt.verify(access_token.value) as any;
          if (!payload) {
              set.status = 401;
              return { error: 'Invalid Token' };
          }
          
          const role = payload.role;
          const tenantId = payload.tenantId || payload.tenant_id;

          if (role !== 'superadmin' && role !== 'tenant_admin') {
              set.status = 403;
              return { error: 'Forbidden' };
          }
          
          if (!tenantId) {
               set.status = 400;
               return { error: 'Tenant ID missing in token payload' };
          }

          const config = await SSOService.getTenantConfig(tenantId);
          if (!config) return { isEnabled: false };
          
          return {
              provider: config.provider,
              clientId: config.clientId,
              issuer: config.issuer,
              isEnabled: config.isEnabled,
              clientSecret: config.clientSecret 
          };
      } catch (e: any) {
          set.status = 400;
          return { error: e.message };
      }
  })
  
  .put('/config', async ({ ssoJwt, cookie: { access_token }, body, set }) => {
      try {
          if (!access_token.value) {
              set.status = 401;
              return { error: 'Unauthorized' };
          }
          const payload = await ssoJwt.verify(access_token.value) as any;
          if (!payload) {
              set.status = 401;
              return { error: 'Invalid Token' };
          }
          
          const role = payload.role;
          const tenantId = payload.tenantId || payload.tenant_id;

          if (role !== 'superadmin' && role !== 'tenant_admin') {
              set.status = 403;
              return { error: 'Forbidden' };
          }
           if (!tenantId) {
               set.status = 400;
               return { error: 'Tenant ID missing in token payload' };
          }

          const { clientId, clientSecret, issuer, provider, isEnabled } = body;
          
          const result = await SSOService.updateConfig(tenantId, {
              tenantId: tenantId,
              provider: provider || 'google',
              clientId,
              clientSecret,
              issuer,
              isEnabled: isEnabled ?? true
          });
          
          return { message: 'SSO Configuration saved', config: result };
      } catch (e: any) {
          set.status = 400;
          return { error: e.message };
      }
  }, {
      body: t.Object({
          clientId: t.String(),
          clientSecret: t.String(),
          issuer: t.String(),
          provider: t.Optional(t.String()),
          isEnabled: t.Optional(t.Boolean())
      })
  });
