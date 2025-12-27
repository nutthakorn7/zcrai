import { db } from '../../infra/db';
import { aiAgentTraces } from '../../infra/db/schema';
import { eq, and, asc } from 'drizzle-orm';

export interface TraceLogEntry {
  tenantId: string;
  alertId?: string;
  caseId?: string;
  agentName: string;
  thought?: string;
  action?: any;
  observation?: any;
}

/**
 * AITraceService provides capabilities to log and retrieve the agent's 
 * "Chain of Thought" (CoT) and interaction history.
 */
export const AITraceService = {
  /**
   * Log a new trace entry for an agent's step
   */
  async logTrace(entry: TraceLogEntry) {
    try {
      const [inserted] = await db.insert(aiAgentTraces).values({
        tenantId: entry.tenantId,
        alertId: entry.alertId,
        caseId: entry.caseId,
        agentName: entry.agentName,
        thought: entry.thought,
        action: entry.action,
        observation: entry.observation,
      }).returning();
      
      return inserted;
    } catch (error) {
      console.error('[AITraceService] Failed to log trace:', error);
      // We don't throw here to avoid crashing the agent flow due to logging failures
      return null;
    }
  },

  /**
   * Get all traces for a specific alert (Timeline)
   */
  async getTracesByAlert(tenantId: string, alertId: string) {
    return await db.select()
      .from(aiAgentTraces)
      .where(and(
        eq(aiAgentTraces.tenantId, tenantId),
        eq(aiAgentTraces.alertId, alertId)
      ))
      .orderBy(asc(aiAgentTraces.createdAt));
  },

  /**
   * Get all traces for a specific case (Timeline)
   */
  async getTracesByCase(tenantId: string, caseId: string) {
    return await db.select()
      .from(aiAgentTraces)
      .where(and(
        eq(aiAgentTraces.tenantId, tenantId),
        eq(aiAgentTraces.caseId, caseId)
      ))
      .orderBy(asc(aiAgentTraces.createdAt));
  }
};
