export interface ActionDefinition {
    id: string;
    name: string;
    description: string;
    riskLevel?: 'low' | 'medium' | 'high' | 'critical'; // For mandatory approval checks
    execute: (context: ActionContext) => Promise<ActionResult>;
}

export interface ActionContext {
    tenantId: string;
    caseId: string;
    executionId: string;
    executionStepId?: string; // Added for granular logging
    userId?: string;
    inputs: Record<string, any>;
    mode?: 'run' | 'dry_run'; // Execution Mode
}

export interface ActionResult {
    success: boolean;
    data?: any;
    error?: string;
}

export class ActionRegistry {
    private static actions: Map<string, ActionDefinition> = new Map();

    static register(action: ActionDefinition) {
        this.actions.set(action.id, action);
    }

    static get(id: string) {
        return this.actions.get(id);
    }

    static list() {
        return Array.from(this.actions.values()).map(a => ({
            id: a.id,
            name: a.name,
            description: a.description,
            riskLevel: a.riskLevel || 'low' // Default to low
        }));
    }

    static async execute(id: string, context: ActionContext): Promise<ActionResult> {
        const action = this.get(id);
        if (!action) {
            throw new Error(`Action ${id} not found`);
        }

        // DRY RUN INTERCEPTION
        if (context.mode === 'dry_run') {
            console.log(`[DryRun] Skipping execution of action '${id}' (Risk: ${action.riskLevel || 'low'})`);
            return {
                success: true,
                data: {
                    dryRun: true,
                    simulated: true,
                    message: `[Dry Run] Action '${action.name}' would have executed with inputs: ${JSON.stringify(context.inputs)}`
                }
            };
        }

        return await action.execute(context);
    }
}
