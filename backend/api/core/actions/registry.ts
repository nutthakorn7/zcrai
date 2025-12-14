import { Action, ActionContext, ActionResult } from './types';

// Registry to hold all available actions
export class ActionRegistry {
  private static actions: Map<string, Action> = new Map();

  static register(action: Action) {
    this.actions.set(action.id, action);
    console.log(`[ActionRegistry] Registered action: ${action.id}`);
  }

  static get(id: string): Action | undefined {
    return this.actions.get(id);
  }

  static list(): Action[] {
    return Array.from(this.actions.values());
  }

  static async execute(actionId: string, context: ActionContext): Promise<ActionResult> {
    const action = this.get(actionId);
    if (!action) {
      return { success: false, error: `Action ${actionId} not found` };
    }
    
    try {
      // Basic input validation could go here (using zod/ajv)
      console.log(`[ActionRegistry] Executing ${actionId} for Case ${context.caseId}`);
      return await action.execute(context);
    } catch (e: any) {
      console.error(`[ActionRegistry] Execution failed for ${actionId}:`, e);
      return { success: false, error: e.message };
    }
  }
}
