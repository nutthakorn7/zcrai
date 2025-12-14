import { db } from '../../infra/db';
import { cloudIntegrations } from '../../infra/db/schema';
import { eq, and } from 'drizzle-orm';
import { EncryptionUtils } from '../utils/encryption';
import { STSClient, GetCallerIdentityCommand } from '@aws-sdk/client-sts';

export const CloudIntegrationService = {

  /**
   * List integrations
   */
  async list(tenantId: string) {
      const results = await db.select().from(cloudIntegrations).where(eq(cloudIntegrations.tenantId, tenantId));
      // Mask credentials in response
      return results.map(i => ({
          ...i,
          credentials: { accessKeyId: '***' } // Don't return secrets
      }));
  },

  /**
   * Create integration
   */
  async create(data: typeof cloudIntegrations.$inferInsert) {
      const { credentials, ...rest } = data;
      
      // Encrypt sensitive fields
      // Assuming credentials is { accessKeyId, secretAccessKey } for AWS OR { clientId, clientSecret } for M365
      const safeCredentials = { ...(credentials as object) } as any;
      if (safeCredentials.secretAccessKey) {
          safeCredentials.secretAccessKey = EncryptionUtils.encrypt(safeCredentials.secretAccessKey);
      }
      if (safeCredentials.clientSecret) {
          safeCredentials.clientSecret = EncryptionUtils.encrypt(safeCredentials.clientSecret);
      }
      // For M365
      if (safeCredentials.clientSecret) {
          safeCredentials.clientSecret = EncryptionUtils.encrypt(safeCredentials.clientSecret);
      }
      // For Azure/GCP, encrypt respective secrets
      
      const [integration] = await db.insert(cloudIntegrations).values({
          ...rest,
          credentials: safeCredentials
      }).returning();
      
      return integration;
  },

  /**
   * Test connection
   */
  async testConnection(id: string, tenantId: string) {
      const [integration] = await db
          .select()
          .from(cloudIntegrations)
          .where(and(eq(cloudIntegrations.id, id), eq(cloudIntegrations.tenantId, tenantId)));

      if (!integration) throw new Error('Integration not found');

      if (integration.provider === 'aws') {
          return this.testAwsConnection(integration.credentials, integration.config);
      } else if (integration.provider === 'm365') {
          return this.testM365Connection(integration.credentials, integration.config);
      } else {
          throw new Error(`Test connection not supported for ${integration.provider}`);
      }
  },

  async delete(id: string, tenantId: string) {
      await db.delete(cloudIntegrations)
          .where(and(eq(cloudIntegrations.id, id), eq(cloudIntegrations.tenantId, tenantId)));
  },

  // --- Private Helpers ---

  async testAwsConnection(credentials: any, config: any) {
      try {
          // Decrypt
          const accessKeyId = credentials.accessKeyId;
          const secretAccessKey = EncryptionUtils.decrypt(credentials.secretAccessKey);
          
          const client = new STSClient({
              region: config.region || 'us-east-1',
              credentials: {
                  accessKeyId,
                  secretAccessKey
              }
          });

          const command = new GetCallerIdentityCommand({});
          const response = await client.send(command);
          
          return {
              success: true,
              message: `Connected as ${response.Arn}`,
              identity: response.UserId
          };
      } catch (error: any) {
          console.error('AWS Connection Error:', error);
          return {
              success: false,
              message: error.message
          };
      }
  },

  async testM365Connection(credentials: any, config: any) {
      try {
          const clientId = credentials.clientId;
          const clientSecret = EncryptionUtils.decrypt(credentials.clientSecret);
          const tenantId = config.tenantId;
          
          // Verify against Microsoft Graph API (Get Access Token)
          // URL: https://login.microsoftonline.com/{tenantId}/oauth2/v2.0/token
          const params = new URLSearchParams();
          params.append('client_id', clientId);
          params.append('scope', 'https://graph.microsoft.com/.default');
          params.append('client_secret', clientSecret);
          params.append('grant_type', 'client_credentials');

          const response = await fetch(`https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`, {
              method: 'POST',
              body: params
          });

          const data = await response.json() as any;

          if (!response.ok) {
               throw new Error(data.error_description || data.error || 'Authentication failed');
          }

          if (!data.access_token) {
              throw new Error('No access token received');
          }

          return {
              success: true,
              message: `Connected to M365 Tenant ${tenantId}`,
              identity: clientId
          };

      } catch (error: any) {
          console.error('M365 Connection Error:', error);
          return {
              success: false,
              message: error.message
          };
      }
  }
};
