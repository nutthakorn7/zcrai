import { db } from '../../infra/db';
import { integrationSecrets, soarActions } from '../../infra/db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { EncryptionUtil } from '../utils/encryption.util';

export interface SOARActionRequest {
  alertId?: string;
  caseId?: string;
  actionType: 'BLOCK_IP' | 'ISOLATE_HOST' | 'RESCIND_EMAIL' | 'KILL_PROCESS';
  provider: string;
  target: string;
  userId: string;
}

/**
 * SOARService manages third-party integrations and active response actions.
 * In this phase, actions are mocked to ensure safety during development.
 */
export const SOARService = {
  /**
   * Save or update integration credentials (encrypted)
   */
  async saveCredentials(tenantId: string, provider: string, data: any) {
    const encrypted = EncryptionUtil.encrypt(JSON.stringify(data));
    
    const existing = await db.select().from(integrationSecrets)
        .where(and(eq(integrationSecrets.tenantId, tenantId), eq(integrationSecrets.provider, provider)))
        .limit(1);

    if (existing.length > 0) {
        return await db.update(integrationSecrets)
            .set({ credentials: encrypted, updatedAt: new Date() })
            .where(eq(integrationSecrets.id, existing[0].id));
    }

    return await db.insert(integrationSecrets).values({
      tenantId,
      provider,
      credentials: encrypted,
    });
  },

  /**
   * List configured integrations for a tenant (redacted credentials)
   */
  async listIntegrations(tenantId: string) {
    const secrets = await db.select().from(integrationSecrets)
        .where(eq(integrationSecrets.tenantId, tenantId));
    
    return secrets.map(s => ({
        id: s.id,
        provider: s.provider,
        isActive: s.isActive,
        createdAt: s.createdAt,
        updatedAt: s.updatedAt
    }));
  },

  /**
   * Execute an active response action.
   * Performs mock execution with an artificial delay.
   */
  async executeAction(tenantId: string, req: SOARActionRequest) {
    // 1. Log the initiation of the action
    const [action] = await db.insert(soarActions).values({
      tenantId,
      alertId: req.alertId,
      caseId: req.caseId,
      actionType: req.actionType,
      provider: req.provider,
      target: req.target,
      status: 'in_progress',
      triggeredBy: 'user',
      userId: req.userId,
    }).returning();

    // 2. Mock execution with delay to simulate API latency
    console.log(`[SOAR] Executing ${req.actionType} on ${req.target} via ${req.provider}...`);
    
    return new Promise((resolve) => {
        setTimeout(async () => {
            const result = {
                message: `Action ${req.actionType} executed successfully on ${req.target}`,
                mocked: true,
                providerResponse: { 
                    status: 'mock_success', 
                    taskId: Math.random().toString(36).substring(7),
                    timestamp: new Date().toISOString()
                }
            };

            await db.update(soarActions)
                .set({
                    status: 'completed',
                    result,
                    updatedAt: new Date()
                })
                .where(eq(soarActions.id, action.id));

            resolve({ success: true, actionId: action.id, result });
        }, 1500);
    });
  },

  /**
   * Retrieve audit logs of SOAR actions for a tenant
   */
  async getActionLogs(tenantId: string, limit = 20) {
      return await db.select().from(soarActions)
          .where(eq(soarActions.tenantId, tenantId))
          .orderBy(desc(soarActions.createdAt))
          .limit(limit);
  },

  /**
   * Delete integration credentials
   */
  async deleteIntegration(tenantId: string, id: string) {
      return await db.delete(integrationSecrets)
          .where(and(eq(integrationSecrets.id, id), eq(integrationSecrets.tenantId, tenantId)));
  }
};
