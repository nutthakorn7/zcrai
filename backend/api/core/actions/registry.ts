
export interface ActionDefinition {
    id: string;
    name: string;
    description: string;
    execute: (context: ActionContext) => Promise<ActionResult>;
}

export interface ActionContext {
    tenantId: string;
    caseId: string;
    executionId: string;
    executionStepId?: string; // Added for granular logging
    userId?: string;
    inputs: Record<string, any>;
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
            description: a.description
        }));
    }

    static async execute(id: string, context: ActionContext): Promise<ActionResult> {
        const action = this.get(id);
        if (!action) {
            throw new Error(`Action ${id} not found`);
        }
        return await action.execute(context);
    }
}
