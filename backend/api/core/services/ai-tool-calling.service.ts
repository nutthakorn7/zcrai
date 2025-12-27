/**
 * AI Tool Calling Service
 * Enables AI to dynamically select and execute tools based on context
 * Uses Gemini Function Calling capability
 */

import { GoogleGenerativeAI } from '@google/generative-ai';

// Tool Definition
export interface ToolDefinition {
  name: string;
  description: string;
  parameters: {
    type: string;
    properties: Record<string, {
      type: string;
      description: string;
      enum?: string[];
    }>;
    required: string[];
  };
  execute: (params: any, context: any) => Promise<any>;
}

// Tool Registry
const toolRegistry: Map<string, ToolDefinition> = new Map();

export class AIToolCallingService {
  private static genAI: GoogleGenerativeAI | null = null;

  private static getGenAI(): GoogleGenerativeAI {
    if (!this.genAI) {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) throw new Error('GEMINI_API_KEY not configured');
      this.genAI = new GoogleGenerativeAI(apiKey);
    }
    return this.genAI;
  }

  /**
   * Register a tool for AI to use
   */
  static registerTool(tool: ToolDefinition): void {
    toolRegistry.set(tool.name, tool);
    console.log(`[ToolCalling] Registered tool: ${tool.name}`);
  }

  /**
   * Get all registered tools
   */
  static getRegisteredTools(): ToolDefinition[] {
    return Array.from(toolRegistry.values());
  }

  /**
   * Let AI decide which tools to call based on context
   */
  static async planToolCalls(context: {
    tenantId: string;
    alertTitle: string;
    alertDescription: string;
    entities: { ip?: string; username?: string; hash?: string };
    objective: string;
  }): Promise<{ tool: string; params: any; reason: string }[]> {
    try {
      const genAI = this.getGenAI();
      const toolDescriptions = Array.from(toolRegistry.values())
        .map(t => `- ${t.name}: ${t.description}`)
        .join('\n');

      const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

      const prompt = `You are a security investigation AI. Given the context, decide which tools to call.

Context:
- Alert: ${context.alertTitle}
- Description: ${context.alertDescription}
- Entities: IP=${context.entities.ip || 'N/A'}, User=${context.entities.username || 'N/A'}, Hash=${context.entities.hash || 'N/A'}
- Objective: ${context.objective}

Available Tools:
${toolDescriptions}

Respond with a JSON array of tool calls. Each object should have:
- tool: tool name
- params: object with parameters
- reason: why this tool is needed

Example:
[
  {"tool": "check_ip_reputation", "params": {"ip": "192.168.1.1"}, "reason": "Check if source IP is malicious"},
  {"tool": "analyze_user_behavior", "params": {"username": "admin"}, "reason": "User performed suspicious action"}
]

If no tools are needed, respond with: []

ONLY respond with valid JSON, no markdown or extra text.`;


      const result = await this.generateContentWithRetry(model, prompt);
      
      // Record Usage
      try {
        const { AICostControlService } = await import('./ai-cost-control.service');
        if (result.response.usageMetadata) {
          await AICostControlService.recordUsage(context.tenantId, { tokens: result.response.usageMetadata as any });
        }
      } catch (e) {
        console.error(`[ToolCalling] Usage recording failed: ${(e as Error).message}`);
      }

      const responseText = result.response.text().trim();

      // Parse JSON
      const jsonMatch = responseText.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        console.warn(`[ToolCalling] No JSON array found in AI response: ${responseText.substring(0, 100)}...`);
        return [];
      }

      try {
        const parsed = JSON.parse(jsonMatch[0]);
        if (!Array.isArray(parsed)) {
          console.warn('[ToolCalling] AI response is not a JSON array');
          return [];
        }

        // Validate structure and filter by registry
        return parsed.filter((call: any) => {
          const isValid = call && typeof call.tool === 'string' && typeof call.reason === 'string';
          const isRegistered = toolRegistry.has(call?.tool);
          if (!isValid) console.warn('[ToolCalling] Skipping invalid tool call structure:', call);
          if (!isRegistered && isValid) console.warn(`[ToolCalling] Skipping unregistered tool: ${call.tool}`);
          return isValid && isRegistered;
        });
      } catch (parseError) {
        console.error(`[ToolCalling] JSON Parse failed: ${(parseError as Error).message}`);
        return [];
      }
    } catch (e) {
      console.error(`[ToolCalling] Planning failed: ${(e as Error).message}`);
      return [];
    }
  }

  /**
   * Helper to call AI with exponential backoff retries (handles 429 Rate Limits)
   */
  private static async generateContentWithRetry(model: any, prompt: string, maxRetries = 3): Promise<any> {
    let lastError: any;
    let delay = 2000;

    for (let i = 0; i < maxRetries; i++) {
      try {
        return await model.generateContent(prompt);
      } catch (error: any) {
        lastError = error;
        const isRateLimit = error.message?.includes('429') || error.status === 429;
        
        if (isRateLimit && i < maxRetries - 1) {
          console.warn(`[ToolCalling] Rate limited (429), retrying in ${delay}ms... (Attempt ${i + 1}/${maxRetries})`);
          await new Promise(resolve => setTimeout(resolve, delay));
          delay *= 2;
          continue;
        }
        break;
      }
    }
    throw lastError;
  }

  /**
   * Execute a planned tool call
   */
  static async executeTool(toolName: string, params: any, context: any): Promise<{
    success: boolean;
    result?: any;
    error?: string;
  }> {
    const tool = toolRegistry.get(toolName);
    if (!tool) {
      return { success: false, error: `Tool not found: ${toolName}` };
    }

    try {
      const result = await tool.execute(params, context);
      return { success: true, result };
    } catch (e) {
      return { success: false, error: (e as Error).message };
    }
  }

  /**
   * Execute multiple tool calls in parallel
   */
  static async executeToolCalls(
    calls: { tool: string; params: any; reason: string }[],
    context: any
  ): Promise<{ tool: string; reason: string; result: any }[]> {
    const results = await Promise.allSettled(
      calls.map(async (call) => {
        const execution = await this.executeTool(call.tool, call.params, context);
        return {
          tool: call.tool,
          reason: call.reason,
          result: execution.success ? execution.result : { error: execution.error }
        };
      })
    );

    return results
      .filter((r): r is PromiseFulfilledResult<any> => r.status === 'fulfilled')
      .map(r => r.value);
  }
}

// ==================== Register Default Security Tools ====================

// Tool: Check IP Reputation
AIToolCallingService.registerTool({
  name: 'check_ip_reputation',
  description: 'Check the reputation of an IP address using threat intelligence providers',
  parameters: {
    type: 'object',
    properties: {
      ip: { type: 'string', description: 'IP address to check' }
    },
    required: ['ip']
  },
  execute: async (params, context) => {
    const { NetworkAgent } = await import('../agents/network-agent');
    const agent = new NetworkAgent();
    return agent.process({ type: 'check_ip', params: { ip: params.ip }, priority: 'high' });
  }
});

// Tool: Query Logs
AIToolCallingService.registerTool({
  name: 'query_security_logs',
  description: 'Query security logs for a specific IP, user, or time range',
  parameters: {
    type: 'object',
    properties: {
      ip: { type: 'string', description: 'IP address to search for' },
      hours: { type: 'number', description: 'Number of hours to look back' }
    },
    required: ['ip']
  },
  execute: async (params, context) => {
    const { NetworkAgent } = await import('../agents/network-agent');
    const agent = new NetworkAgent();
    return agent.process({ type: 'query_logs', params: { ip: params.ip, hours: params.hours || 24 }, priority: 'medium' });
  }
});

// Tool: Analyze File Hash
AIToolCallingService.registerTool({
  name: 'analyze_file_hash',
  description: 'Check a file hash against malware databases like VirusTotal',
  parameters: {
    type: 'object',
    properties: {
      hash: { type: 'string', description: 'File hash (MD5, SHA1, or SHA256)' }
    },
    required: ['hash']
  },
  execute: async (params, context) => {
    const { FileAgent } = await import('../agents/file-agent');
    const agent = new FileAgent();
    return agent.process({ type: 'check_hash', params: { hash: params.hash }, priority: 'high' });
  }
});

// Tool: Analyze User Behavior
AIToolCallingService.registerTool({
  name: 'analyze_user_behavior',
  description: 'Analyze user behavior and risk score based on login history and sessions',
  parameters: {
    type: 'object',
    properties: {
      username: { type: 'string', description: 'Username or email to analyze' }
    },
    required: ['username']
  },
  execute: async (params, context) => {
    const { UserAgent } = await import('../agents/user-agent');
    const agent = new UserAgent();
    return agent.process({ type: 'check_user', params: { username: params.username, tenantId: context.tenantId }, priority: 'medium' });
  }
});

// Tool: Recall Similar Investigations
AIToolCallingService.registerTool({
  name: 'recall_similar_investigations',
  description: 'Search memory for similar past investigations and patterns',
  parameters: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'Description of what to search for' }
    },
    required: ['query']
  },
  execute: async (params, context) => {
    const { AgentMemoryService } = await import('../services/agent-memory.service');
    return AgentMemoryService.recallPatterns(context.tenantId, {
      title: params.query,
      description: params.query
    }, 3);
  }
});

// Tool: Enrich Domain
AIToolCallingService.registerTool({
  name: 'enrich_domain',
  description: 'Get threat intelligence about a domain name',
  parameters: {
    type: 'object',
    properties: {
      domain: { type: 'string', description: 'Domain name to enrich' }
    },
    required: ['domain']
  },
  execute: async (params, context) => {
    const { ThreatIntelService } = await import('../services/threat-intel.service');
    return ThreatIntelService.lookup(params.domain, 'domain');
  }
});

console.log(`[ToolCalling] Initialized with ${AIToolCallingService.getRegisteredTools().length} tools`);
