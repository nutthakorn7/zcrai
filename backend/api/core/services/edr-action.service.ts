/**
 * EDR Action Service
 * Routes and executes EDR response actions with approval workflow
 */

import { db } from '../../infra/db';
import { playbookExecutionSteps, apiKeys } from '../../infra/db/schema';
import { eq, and } from 'drizzle-orm';
import { Encryption } from '../../utils/encryption';

export interface EDRActionResult {
  success: boolean;
  message: string;
  data?: any;
  error?: string;
}

export interface EDRActionRequest {
  provider: 'crowdstrike' | 'sentinelone';
  action: string;
  parameters: Record<string, any>;
  executionStepId: string;
  requiresApproval?: boolean;
  tenantId?: string; // Optional for manual actions, required for integration lookup
}

export class EDRActionService {
  private static mockMode = process.env.EDR_MOCK_MODE !== 'false'; // Default to mock

  /**
   * Execute EDR action
   */
  static async executeAction(request: EDRActionRequest): Promise<EDRActionResult> {
    try {
      // Log action attempt
      await this.logAction(request.executionStepId, 'attempting', request);

      // Route to appropriate provider
      let result: EDRActionResult;
      
      if (request.provider === 'crowdstrike') {
        const { CrowdStrikeActions } = await import('../../integrations/crowdstrike-actions');
        result = await CrowdStrikeActions.execute(request.action, request.parameters, this.mockMode);
      } else if (request.provider === 'sentinelone') {
        const { SentinelOneActions } = await import('../../integrations/sentinelone-actions');
        
        // Fetch credentials from DB if tenantId is provided
        let config;
        if (request.tenantId) {
          try {
            const [integration] = await db
              .select()
              .from(apiKeys)
              .where(and(
                eq(apiKeys.tenantId, request.tenantId),
                eq(apiKeys.provider, 'sentinelone')
              ));

            if (integration && integration.encryptedKey) {
              const decrypted = JSON.parse(Encryption.decrypt(integration.encryptedKey));
              if (decrypted.url && decrypted.token) {
                config = { url: decrypted.url, token: decrypted.token };
              }
            }
          } catch (error) {
            console.error('Failed to fetch/decrypt SentinelOne credentials:', error);
          }
        }

        result = await SentinelOneActions.execute(request.action, request.parameters, this.mockMode, config);
      } else {
        throw new Error(`Unsupported EDR provider: ${request.provider}`);
      }

      // Log success
      await this.logAction(request.executionStepId, 'completed', result);

      return result;
    } catch (error: any) {
      const errorResult: EDRActionResult = {
        success: false,
        message: 'Action failed',
        error: error.message,
      };

      // Log failure
      await this.logAction(request.executionStepId, 'failed', errorResult);

      return errorResult;
    }
  }

  /**
   * Check if action requires approval
   */
  static requiresApproval(action: string): boolean {
    const dangerousActions = [
      'isolate_host',
      'quarantine_host',
      'kill_process',
      'terminate_process',
      'delete_file',
      'shutdown_host',
    ];
    
    return dangerousActions.includes(action);
  }

  /**
   * Get available actions for provider
   */
  static getAvailableActions(provider: 'crowdstrike' | 'sentinelone'): string[] {
    if (provider === 'crowdstrike') {
      return [
        'isolate_host',
        'lift_containment',
        'kill_process',
        'get_device_details',
      ];
    } else if (provider === 'sentinelone') {
      return [
        'quarantine_host',
        'unquarantine_host',
        'blocklist_hash',
        'get_agent_details',
      ];
    }
    return [];
  }

  /**
   * Validate action parameters
   */
  static validateParameters(action: string, parameters: Record<string, any>): { valid: boolean; error?: string } {
    // Common validations
    const hostActions = ['isolate_host', 'lift_containment', 'quarantine_host', 'unquarantine_host'];
    const processActions = ['kill_process', 'terminate_process'];
    const hashActions = ['blocklist_hash'];

    if (hostActions.includes(action)) {
      if (!parameters.agentId && !parameters.deviceId) {
        return { valid: false, error: 'agentId or deviceId required' };
      }
    } else if (processActions.includes(action)) {
      if (!parameters.processId && !parameters.pid) {
        return { valid: false, error: 'processId or pid required' };
      }
    } else if (hashActions.includes(action)) {
      if (!parameters.hash) {
        return { valid: false, error: 'hash required' };
      }
    }

    return { valid: true };
  }

  /**
   * Log action to execution step
   */
  private static async logAction(
    executionStepId: string,
    status: 'attempting' | 'completed' | 'failed',
    data: any
  ): Promise<void> {
    try {
      const timestamp = new Date().toISOString();
      const logEntry = {
        timestamp,
        status,
        ...data,
      };

      // Get current output
      const [step] = await db
        .select()
        .from(playbookExecutionSteps)
        .where(eq(playbookExecutionSteps.id, executionStepId));

      if (!step) return;

      const currentResult = (step.result as any) || {};
      const auditLog = currentResult.auditLog || [];
      auditLog.push(logEntry);

      // Update step result
      await db
        .update(playbookExecutionSteps)
        .set({
          result: {
            ...currentResult,
            auditLog,
            lastAction: logEntry,
          } as any,
        })
        .where(eq(playbookExecutionSteps.id, executionStepId));
    } catch (error) {
      console.error('Failed to log EDR action:', error);
    }
  }

  /**
   * Get mock mode status
   */
  static isMockMode(): boolean {
    return this.mockMode;
  }

  /**
   * Set mock mode (for testing)
   */
  static setMockMode(enabled: boolean): void {
    this.mockMode = enabled;
  }

  /**
   * Generate action summary for approval UI
   */
  static generateActionSummary(request: EDRActionRequest): string {
    const { provider, action, parameters } = request;
    
    const providerName = provider === 'crowdstrike' ? 'CrowdStrike' : 'SentinelOne';
    const target = parameters.agentId || parameters.deviceId || parameters.hash || 'unknown';

    const actionDescriptions: Record<string, string> = {
      isolate_host: `Isolate host ${target} from network`,
      lift_containment: `Lift network isolation for ${target}`,
      quarantine_host: `Quarantine host ${target}`,
      unquarantine_host: `Remove quarantine from ${target}`,
      kill_process: `Terminate process ${parameters.processId || parameters.pid}`,
      blocklist_hash: `Block file hash ${target}`,
    };

    return actionDescriptions[action] || `Execute ${action} on ${providerName}`;
  }
}
