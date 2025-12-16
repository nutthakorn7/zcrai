import { Elysia, t } from 'elysia'
import { jwt } from '@elysiajs/jwt'
import { SSOService } from '../core/services/sso.service'
import { AuthService } from '../core/services/auth.service'
import { setAccessTokenCookie, setRefreshTokenCookie } from '../config/cookies'
import { Errors } from '../middleware/error'

export const ssoController = new Elysia({ prefix: '/auth/sso' })
  // Public Routes (uses ssoJwt for signing tokens in callback)
  .use(
    jwt({
        name: 'ssoJwt',
        secret: process.env.JWT_SECRET || 'super_secret_dev_key',
        exp: process.env.JWT_ACCESS_EXPIRY || '7d'
    })
  )
  .get('/login', async ({ query, redirect }: any) => {
    const { provider, tenantId } = query;
    if (!provider || !tenantId) throw Errors.BadRequest('Missing provider or tenantId');
    
    const url = await SSOService.getAuthorizationUrl(tenantId, provider);
    return redirect(url);
  }, {
      query: t.Object({
          provider: t.String(),
          tenantId: t.String()
      })
  })
  .get('/callback', async ({ request, query, ssoJwt, cookie: { access_token, refresh_token }, redirect }: any) => {
      const currentUrl = new URL(request.url);
      const state = query.state;
      if (!state) throw Errors.BadRequest('Missing state (tenantId)');
      
      const result = await SSOService.handleCallback(state, 'google', currentUrl);
      
      const email = (result.claims as any)?.email as string;
      if (!email) throw Errors.BadRequest('No email provided by IDP');

      
      let user = await AuthService.getUserByEmail(email);
      if (!user) {
          throw Errors.NotFound('User');
      }
      
      // Sign token including tenantId
      const accessToken = await ssoJwt.sign({
          id: user.id,
          role: user.role,
          tenantId: user.tenantId
      });

      const userAgent = request.headers.get('user-agent') || undefined;
      const refreshTokenValue = await AuthService.createRefreshToken(user.id, userAgent);

      setAccessTokenCookie(access_token, accessToken);
      setRefreshTokenCookie(refresh_token, refreshTokenValue);
      
      return redirect('/dashboard');
  })
  
  // ==================== PROTECTED SETTINGS ROUTES ====================
  .get('/config', async ({ ssoJwt, cookie: { access_token } }: any) => {
      if (!access_token.value) throw Errors.Unauthorized();
      
      const payload = await ssoJwt.verify(access_token.value as string) as any;
      if (!payload) throw Errors.Unauthorized('Invalid Token');
      
      const role = payload.role;
      const tenantId = payload.tenantId || payload.tenant_id;

      if (role !== 'superadmin' && role !== 'tenant_admin') {
          throw Errors.Forbidden();
      }
      
      if (!tenantId) {
           throw Errors.BadRequest('Tenant ID missing in token payload');
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
  })
  
  .put('/config', async ({ ssoJwt, cookie: { access_token }, body }: any) => {
      if (!access_token.value) throw Errors.Unauthorized();
      
      const payload = await ssoJwt.verify(access_token.value as string) as any;
      if (!payload) throw Errors.Unauthorized('Invalid Token');
      
      const role = payload.role;
      const tenantId = payload.tenantId || payload.tenant_id;

      if (role !== 'superadmin' && role !== 'tenant_admin') {
          throw Errors.Forbidden();
      }
       if (!tenantId) {
           throw Errors.BadRequest('Tenant ID missing in token payload');
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
  }, {
      body: t.Object({
          clientId: t.String(),
          clientSecret: t.String(),
          issuer: t.String(),
          provider: t.Optional(t.String()),
          isEnabled: t.Optional(t.Boolean())
      })
  });
