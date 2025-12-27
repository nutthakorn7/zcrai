import { ActionDefinition, ActionContext, ActionResult } from '../registry';
// Dynamic import to avoid circular deps if any, but EDRActionService should be fine
import { EDRActionService } from '../../services/edr-action.service'; 

export const IsolateHostAction: ActionDefinition = {
    id: 'isolate_host',
    name: 'Isolate Host',
    description: 'Isolates a host from the network using EDR agent',
    execute: async (context: ActionContext): Promise<ActionResult> => {
        const { agent_id, device_id, hostname } = context.inputs;
        const target = agent_id || device_id || hostname;

        if (!target) {
            throw new Error('Missing input: agent_id, device_id, or hostname');
        }

        console.log(`[IsolateHost] Isolating host ${target} for tenant ${context.tenantId}`);

        // Construct EDR Request
        // Assuming CrowdStrike for now as default, or parameterize input
        const provider = (context.inputs.provider as 'crowdstrike' | 'sentinelone') || 'crowdstrike';

        const result = await EDRActionService.executeAction({
            provider: provider,
            action: 'isolate_host',
            parameters: {
                agentId: agent_id || device_id, // Map inputs to EDR params
                hostname: hostname
            },
            executionStepId: context.executionStepId || context.executionId, 
        } as any);

        return {
            success: result.success,
            data: result.data,
            error: result.error
        };
    }
};
