export interface ActionContext {
  tenantId: string;
  caseId: string;
  executionId: string;
  userId?: string;
  inputs: Record<string, any>; // Parameters from Step Config
}

export interface ActionResult {
  success: boolean;
  output?: any;
  error?: string;
  artifacts?: { name: string; content: string }[];
}

export interface Action {
  id: string;
  name: string;
  description: string;
  version: string;
  schema: { // JSON Schema for inputs
    type: 'object';
    properties: Record<string, any>;
    required?: string[];
  };
  execute: (context: ActionContext) => Promise<ActionResult>;
}
