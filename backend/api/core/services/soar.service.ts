import { db } from '../../infra/db'
import { soarActions, alerts } from '../../infra/db/schema'
import { eq, desc, and } from 'drizzle-orm'

export type SoarActionType = 'BLOCK_IP' | 'ISOLATE_HOST' | 'QUARANTINE_FILE' | 'KILL_PROCESS' | 'DUMP_MEMORY'

export interface SoarActionParams {
  tenantId: string
  caseId?: string
  alertId?: string
  actionType: SoarActionType
  provider: string
  target: string
  triggeredBy?: 'ai' | 'user' | 'playbook'
  userId?: string
}

export class SoarService {
  /**
   * Execute a security action and log it
   */
  static async execute(params: SoarActionParams): Promise<any> {
    console.log(`[SoarService] Executing action: ${params.actionType} on ${params.target} via ${params.provider}`);

    // 1. Create Initial Log Entry
    const [actionLog] = await db.insert(soarActions).values({
      tenantId: params.tenantId,
      caseId: params.caseId,
      alertId: params.alertId,
      actionType: params.actionType,
      provider: params.provider,
      target: params.target,
      status: 'in_progress',
      triggeredBy: params.triggeredBy || 'ai',
      userId: params.userId,
    }).returning();

    try {
      let result: any;

      // 2. Dispatch to Provider-specific Logic
      // In a real implementation, this would call actual provider APIs (S1, CS, Firewall)
      // For Phase 14, we will use our existing service placeholders or simulated responses
      switch (params.actionType) {
        case 'BLOCK_IP':
          result = await this.blockIp(params);
          break;
        case 'ISOLATE_HOST':
          result = await this.isolateHost(params);
          break;
        default:
          throw new Error(`Action type ${params.actionType} not implemented yet`);
      }

      // 3. Update Status to Completed
      await db.update(soarActions)
        .set({ 
          status: 'completed', 
          result,
          updatedAt: new Date() 
        })
        .where(eq(soarActions.id, actionLog.id));

      return result;
    } catch (error: any) {
      console.error(`[SoarService] Action Failed:`, error);
      
      // 4. Update Status to Failed
      await db.update(soarActions)
        .set({ 
          status: 'failed', 
          error: error.message,
          updatedAt: new Date() 
        })
        .where(eq(soarActions.id, actionLog.id));

      throw error;
    }
  }

  // --- Provider Mapping Placeholder Methods ---

  private static async blockIp(params: SoarActionParams) {
    // Logic to call Fortigate, Cisco, or EDR firewall
    // For now, simulate success
    return {
      status: 'success',
      provider_response: `IP ${params.target} blocked on ${params.provider} firewall`,
      timestamp: new Date().toISOString()
    };
  }

  private static async isolateHost(params: SoarActionParams) {
    // Logic to call S1 or CS isolation API
    const sensorId = params.target;
    
    // Simulate API call
    return {
      status: 'success',
      provider_response: `Host ${sensorId} network isolated via ${params.provider}`,
      isolation_token: `iso-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * List recent actions for a tenant
   */
  static async listActions(tenantId: string, limit = 50) {
    return await db.query.soarActions.findMany({
      where: eq(soarActions.tenantId, tenantId),
      orderBy: (actions, { desc }) => [desc(actions.createdAt)],
      limit
    });
  }

  /**
   * Get actions joined with alert data for the Autopilot feed
   */
  static async getRecentAutopilotActions(tenantId: string, limit = 20) {
    const results = await db.select({
      id: soarActions.id,
      actionType: soarActions.actionType,
      target: soarActions.target,
      status: soarActions.status,
      triggeredBy: soarActions.triggeredBy,
      createdAt: soarActions.createdAt,
      alertTitle: alerts.title,
      alertSeverity: alerts.severity,
      aiAnalysis: alerts.aiAnalysis,
      result: soarActions.result,
      error: soarActions.error
    })
    .from(soarActions)
    .leftJoin(alerts, eq(soarActions.alertId, alerts.id))
    .where(eq(soarActions.tenantId, tenantId))
    .orderBy(desc(soarActions.createdAt))
    .limit(limit);

    return results;
  }

  /**
   * Calculate Autopilot ROI Stats
   */
  static async getAutopilotStats(tenantId: string) {
    const actions = await db.select()
      .from(soarActions)
      .where(and(eq(soarActions.tenantId, tenantId), eq(soarActions.status, 'completed')));
    
    const totalRemediations = actions.length;
    const timeSavedMinutes = totalRemediations * 15; // Assumption: 15 mins saved per automated action
    
    return {
      totalRemediations,
      timeSavedMinutes,
      threatsBlocked: actions.filter(a => a.actionType === 'BLOCK_IP' || a.actionType === 'ISOLATE_HOST').length
    };
  }
}
