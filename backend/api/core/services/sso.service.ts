import { discovery, authorizationCodeGrant, buildAuthorizationUrl, calculatePKCECodeChallenge, randomPKCECodeVerifier, randomState } from 'openid-client';
import { db } from '../../infra/db';
import { ssoConfigs } from '../../infra/db/schema';
import { eq } from 'drizzle-orm';

// Define Interface for cached config since v6 changes architecture (functional vs class)
// Note: v6 returns a Configuration object.
// We will store the DISCOVERED configuration.

export class SSOService {
  private static configs: Map<string, any> = new Map();

  /**
   * Get or discover OIDC configuration (Internal use for Auth flow)
   */
  private static async getConfig(tenantId: string, provider: string) {
    const cacheKey = `${tenantId}:${provider}`;
    if (this.configs.has(cacheKey)) {
      return this.configs.get(cacheKey)!;
    }

    // Fetch config from DB
    const [dbConfig] = await db
      .select()
      .from(ssoConfigs)
      .where(eq(ssoConfigs.tenantId, tenantId));
    
    if (!dbConfig || !dbConfig.isEnabled) {
      throw new Error('SSO not configured or disabled for this tenant');
    }

    const oidcConfig = await discovery(new URL(dbConfig.issuer), dbConfig.clientId, dbConfig.clientSecret);
    this.configs.set(cacheKey, { oidcConfig, dbConfig });
    return { oidcConfig, dbConfig };
  }

  /**
   * Get Tenant Config (For Settings Page)
   */
  static async getTenantConfig(tenantId: string) {
      const [config] = await db
          .select()
          .from(ssoConfigs)
          .where(eq(ssoConfigs.tenantId, tenantId));
      return config || null;
  }

  /**
   * Update or Create Tenant Config
   */
  static async updateConfig(tenantId: string, data: typeof ssoConfigs.$inferInsert) {
      // Check if exists
      const existing = await this.getTenantConfig(tenantId);
      
      let result;
      if (existing) {
          [result] = await db.update(ssoConfigs)
              .set({ ...data, tenantId }) // Ensure tenantId matches
              .where(eq(ssoConfigs.tenantId, tenantId))
              .returning();
      } else {
          [result] = await db.insert(ssoConfigs)
              .values({ ...data, tenantId })
              .returning();
      }
      
      // Clear cache
      this.configs.clear();
      
      return result;
  }

  /**
   * Generate Auth URL
   */
  static async getAuthorizationUrl(tenantId: string, provider: string) {
    const { oidcConfig, dbConfig } = await this.getConfig(tenantId, provider);
    
    // v6 helper
    const state = tenantId; // Using tenantId as state for simplicity
    const redirect_uri = `${process.env.API_URL || 'http://localhost:8000'}/auth/sso/callback`;

    const url = buildAuthorizationUrl(oidcConfig, {
        redirect_uri,
        scope: 'openid email profile',
        state,
        response_type: 'code' // Optional, defaults to code
    });

    return url.href;
  }

  /**
   * Handle Callback
   */
  static async handleCallback(tenantId: string, provider: string, currentUrl: URL) {
     const { oidcConfig } = await this.getConfig(tenantId, provider);
     
     // Exchange code
     const tokenHelper = await authorizationCodeGrant(oidcConfig, currentUrl, {
         expectedState: tenantId, 
     });

     // TokenHelper contains access_token, id_token, claims() etc.
     // In v6:
     // tokenHelper.access_token
     // tokenHelper.id_token
     // tokenHelper.claims() -> functional or property?
     // Check exports: "fetchUserInfo" is separate. "claims" method usually on TokenSet?
     // Actually authorizationCodeGrant returns "TokenEndpointResponse & { claims?: ... }" ?
     // Let's assume it returns an object with `claims` function or property if ID Token verified.
     // Based on standard simple-oidc flavors which v6 seems to be.
     // Docs: Result has .claims() method if ID token present.
     
     let claims;
     if (tokenHelper.claims) {
         claims = tokenHelper.claims();
     } else {
         // Fallback if no claims method (should exist)
         claims = {}; 
     }

     return { claims };
  }
}
