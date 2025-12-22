import { db } from '../../infra/db';
import { ssoConfigs, users, tenants } from '../../infra/db/schema';
import { eq } from 'drizzle-orm';
import * as client from 'openid-client';

export class SSOService {
  
  /**
   * Get OIDC Client for a tenant
   */
  private static async getClient(tenantId: string) {
    const config = await db.query.ssoConfigs.findFirst({
        where: eq(ssoConfigs.tenantId, tenantId)
    });

    if (!config || !config.isEnabled) {
        throw new Error('SSO not configured or disabled for this tenant');
    }

    const issuer = await client.discovery(new URL(config.issuer), config.clientId, config.clientSecret);
    return issuer;
  }

  /**
   * Calculate Authorization URL
   */
  static async getAuthUrl(tenantId: string) {
    const config = await db.query.ssoConfigs.findFirst({
        where: eq(ssoConfigs.tenantId, tenantId)
    });

    if (!config || !config.isEnabled) {
        throw new Error('SSO not configured');
    }

    const oidcConfig = await client.discovery(new URL(config.issuer), config.clientId, config.clientSecret);

    // Dynamic redirect URI based on env
    const redirectUri = `${process.env.BACKEND_URL || 'http://localhost:8000'}/auth/sso/callback?tenantId=${tenantId}`;

    const parameters: Record<string, string> = {
      redirect_uri: redirectUri,
      scope: 'openid email profile',
    };

    return client.buildAuthorizationUrl(oidcConfig, parameters).href;
  }

  /**
   * Handle Callback and Login/Register User
   */
  static async handleCallback(tenantId: string, url:  URL) {
    const config = await db.query.ssoConfigs.findFirst({
        where: eq(ssoConfigs.tenantId, tenantId)
    });

    if (!config) throw new Error('Invalid SSO Config');

    const oidcConfig = await client.discovery(new URL(config.issuer), config.clientId, config.clientSecret);
    const redirectUri = `${process.env.BACKEND_URL || 'http://localhost:8000'}/auth/sso/callback?tenantId=${tenantId}`;

    // Exchange code for tokens
    const tokens = await client.authorizationCodeGrant(oidcConfig, url);

    // Fetch user info
    const claims = tokens.claims();
    if (!claims || !claims.sub) throw new Error('Invalid ID Token');

    const userInfo = await client.fetchUserInfo(oidcConfig, tokens.access_token, claims.sub);

    if (!userInfo.email) throw new Error('Email not provided by IdP');

    // Find or Create User
    let user = await db.query.users.findFirst({
        where: eq(users.email, userInfo.email)
    });

    if (!user) {
        // JIT Provisioning
        const newUser = await db.insert(users).values({
            email: userInfo.email,
            name: userInfo.name || userInfo.email.split('@')[0],
            tenantId: tenantId,
            passwordHash: 'SSO_MANAGED',
            role: 'analyst', // Default role
            ssoProvider: config.provider,
            ssoId: userInfo.sub,
            status: 'active'
        }).returning();
        user = newUser[0];
    } else {
        // Link existing account if not linked
        if (user.ssoProvider === 'local') {
            await db.update(users)
                .set({ 
                    ssoProvider: config.provider,
                    ssoId: userInfo.sub 
                })
                .where(eq(users.id, user.id));
        }
    }

    return user;
  }
}
