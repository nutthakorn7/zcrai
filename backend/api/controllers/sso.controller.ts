import { Elysia, t } from 'elysia'
import { jwt } from '@elysiajs/jwt'
import { SSOService } from '../core/services/sso.service'
import { AuthService } from '../core/services/auth.service'
import { setAccessTokenCookie, setRefreshTokenCookie } from '../config/cookies'
import { Errors } from '../middleware/error'

export const ssoController = new Elysia({ prefix: '/auth/sso' })
  .use(
    jwt({
        name: 'ssoJwt',
        secret: process.env.JWT_SECRET || 'super_secret_dev_key',
        exp: process.env.JWT_ACCESS_EXPIRY || '7d'
    })
  )
  
  /**
   * Initiate SSO login flow
   * @route GET /auth/sso/login
   * @access Public
   * @query {string} provider - SSO provider (google, azure, okta)
   * @query {string} tenantId - Tenant ID for SSO configuration
   * @returns {Redirect} Redirects to SSO provider authorization page
   * @throws {400} Missing provider or tenantId
   */
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
  
  /**
   * Handle SSO callback from identity provider
   * @route GET /auth/sso/callback
   * @access Public
   * @query {string} state - Tenant ID state parameter
   * @query {string} code - Authorization code from IDP
   * @returns {Redirect} Redirects to dashboard with authentication cookies
   * @throws {400} Missing state or invalid user
   * @description Exchanges authorization code for tokens and creates user session
   */
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
  
  /**
   * Get SSO configuration for tenant
   * @route GET /auth/sso/config
   * @access Protected - Admin/SuperAdmin only
   * @returns {Object} SSO configuration (provider, clientId, issuer, isEnabled)
   * @throws {401} Unauthorized
   * @throws {403} Forbidden (wrong role)
   */
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
  
  /**
   * Update SSO configuration for tenant
   * @route PUT /auth/sso/config
   * @access Protected - Admin/SuperAdmin only
   * @body {string} clientId - OAuth client ID
   * @body {string} clientSecret - OAuth client secret
   * @body {string} issuer - IDP issuer URL
   * @body {string} provider - SSO provider (optional, default: google)
   * @body {boolean} isEnabled - Enable/disable SSO (optional, default: true)
   * @returns {Object} Success message with saved configuration
   * @throws {401} Unauthorized
   * @throws {403} Forbidden
   */
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
