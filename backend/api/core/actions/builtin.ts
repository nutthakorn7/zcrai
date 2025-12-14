import { Action, ActionContext, ActionResult } from './types';
import { ActionRegistry } from './registry';

// --- Block IP Action ---
const BlockIPAction: Action = {
  id: 'block_ip',
  name: 'Block IP Address',
  description: 'Blocks an IP address on the firewall (Mock)',
  version: '1.0.0',
  schema: {
    type: 'object',
    properties: {
      ip: { type: 'string', description: 'IP Address to block' }
    },
    required: ['ip']
  },
  execute: async (ctx: ActionContext): Promise<ActionResult> => {
    const { ip } = ctx.inputs;
    if (!ip) return { success: false, error: 'IP Address is required' };

    // Simulation delay
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    console.log(`[BlockIP] Blocking ${ip}... DONE`);
    
    return {
      success: true,
      output: {
        status: 'blocked',
        firewall_rule_id: `rule-${Math.floor(Math.random() * 10000)}`,
        timestamp: new Date().toISOString()
      }
    };
  }
};

// --- Send Email Action ---
const SendEmailAction: Action = {
  id: 'send_email',
  name: 'Send Email Notification',
  description: 'Sends an email to a recipient',
  version: '1.0.0',
  schema: {
    type: 'object',
    properties: {
      to: { type: 'string', description: 'Recipient Email' },
      subject: { type: 'string', description: 'Subject Line' },
      body: { type: 'string', description: 'Email Body' }
    },
    required: ['to', 'subject']
  },
  execute: async (ctx: ActionContext): Promise<ActionResult> => {
    const { to, subject, body } = ctx.inputs;
    // In real app, import EmailService
    // await EmailService.send({ to, subject, html: body });
    
    await new Promise(resolve => setTimeout(resolve, 1000));
    console.log(`[SendEmail] Sending to ${to}: ${subject}`);
    
    return {
      success: true,
      output: {
        messageId: `msg-${Date.now()}`,
        status: 'sent'
      }
    };
  }
};

// --- CrowdStrike: Isolate Host Action ---
const CrowdStrikeIsolateHostAction: Action = {
  id: 'crowdstrike_isolate_host',
  name: 'CrowdStrike: Isolate Host',
  description: 'Isolate a host from the network using CrowdStrike Falcon',
  version: '1.0.0',
  schema: {
    type: 'object',
    properties: {
      deviceId: { type: 'string', description: 'CrowdStrike Device ID' },
      agentId: { type: 'string', description: 'Agent ID (alternative)' },
    },
    required: ['deviceId']
  },
  execute: async (ctx: ActionContext): Promise<ActionResult> => {
    const { EDRActionService } = await import('../services/edr-action.service');
    
    const result = await EDRActionService.executeAction({
      provider: 'crowdstrike',
      action: 'isolate_host',
      parameters: ctx.inputs,
      executionStepId: ctx.executionId || '',
      requiresApproval: true,
    });
    
    return {
      success: result.success,
      output: result.data,
      error: result.error,
    };
  }
};

// --- CrowdStrike: Lift Containment Action ---
const CrowdStrikeLiftContainmentAction: Action = {
  id: 'crowdstrike_lift_containment',
  name: 'CrowdStrike: Lift Containment',
  description: 'Remove network isolation from a host',
  version: '1.0.0',
  schema: {
    type: 'object',
    properties: {
      deviceId: { type: 'string', description: 'CrowdStrike Device ID' },
    },
    required: ['deviceId']
  },
  execute: async (ctx: ActionContext): Promise<ActionResult> => {
    const { EDRActionService } = await import('../services/edr-action.service');
    
    const result = await EDRActionService.executeAction({
      provider: 'crowdstrike',
      action: 'lift_containment',
      parameters: ctx.inputs,
      executionStepId: ctx.executionId || '',
    });
    
    return {
      success: result.success,
      output: result.data,
      error: result.error,
    };
  }
};

// --- SentinelOne: Quarantine Host Action ---
const SentinelOneQuarantineHostAction: Action = {
  id: 'sentinelone_quarantine_host',
  name: 'SentinelOne: Quarantine Host',
  description: 'Disconnect a host from the network using SentinelOne',
  version: '1.0.0',
  schema: {
    type: 'object',
    properties: {
      agentId: { type: 'string', description: 'SentinelOne Agent ID' },
    },
    required: ['agentId']
  },
  execute: async (ctx: ActionContext): Promise<ActionResult> => {
    const { EDRActionService } = await import('../services/edr-action.service');
    
    const result = await EDRActionService.executeAction({
      provider: 'sentinelone',
      action: 'quarantine_host',
      parameters: ctx.inputs,
      executionStepId: ctx.executionId || '',
      requiresApproval: true,
    });
    
    return {
      success: result.success,
      output: result.data,
      error: result.error,
    };
  }
};

// --- SentinelOne: Unquarantine Host Action ---
const SentinelOneUnquarantineHostAction: Action = {
  id: 'sentinelone_unquarantine_host',
  name: 'SentinelOne: Unquarantine Host',
  description: 'Reconnect a host to the network',
  version: '1.0.0',
  schema: {
    type: 'object',
    properties: {
      agentId: { type: 'string', description: 'SentinelOne Agent ID' },
    },
    required: ['agentId']
  },
  execute: async (ctx: ActionContext): Promise<ActionResult> => {
    const { EDRActionService } = await import('../services/edr-action.service');
    
    const result = await EDRActionService.executeAction({
      provider: 'sentinelone',
      action: 'unquarantine_host',
      parameters: ctx.inputs,
      executionStepId: ctx.executionId || '',
    });
    
    return {
      success: result.success,
      output: result.data,
      error: result.error,
    };
  }
};

// --- SentinelOne: Blocklist Hash Action ---
const SentinelOneBlocklistHashAction: Action = {
  id: 'sentinelone_blocklist_hash',
  name: 'SentinelOne: Blocklist File Hash',
  description: 'Add a file hash to the global blocklist',
  version: '1.0.0',
  schema: {
    type: 'object',
    properties: {
      hash: { type: 'string', description: 'File hash (SHA256/SHA1/MD5)' },
      scope: { type: 'string', description: 'Scope (site/account)', default: 'site' },
    },
    required: ['hash']
  },
  execute: async (ctx: ActionContext): Promise<ActionResult> => {
    const { EDRActionService } = await import('../services/edr-action.service');
    
    const result = await EDRActionService.executeAction({
      provider: 'sentinelone',
      action: 'blocklist_hash',
      parameters: ctx.inputs,
      executionStepId: ctx.executionId || '',
    });
    
    return {
      success: result.success,
      output: result.data,
      error: result.error,
    };
  }
};

// --- Memory Forensics: Capture Memory Dump ---
const CaptureMemoryDumpAction: Action = {
  id: 'capture_memory_dump',
  name: 'Forensics: Capture Memory Dump',
  description: 'Capture memory dump from a target host for forensic analysis',
  version: '1.0.0',
  schema: {
    type: 'object',
    properties: {
      hostname: { type: 'string', description: 'Target hostname' },
      collectedBy: { type: 'string', description: 'Analyst performing collection' },
      caseId: { type: 'string', description: 'Associated case ID' },
    },
    required: ['hostname', 'collectedBy']
  },
  execute: async (ctx: ActionContext): Promise<ActionResult> => {
    const { ForensicsService } = await import('../services/forensics.service');
    const { EvidenceService } = await import('../services/evidence.service');
    
    const { hostname, collectedBy, caseId } = ctx.inputs;
    
    // Capture memory dump
    const result = await ForensicsService.captureMemoryDump(hostname, collectedBy, caseId);
    
    // Register as evidence
    if (caseId) {
      await EvidenceService.registerEvidence({
        caseId,
        type: 'memory_dump',
        name: `${hostname}-memory-${new Date().toISOString()}`,
        collectedBy,
        hash: result.hash,
        metadata: { hostname, captureMethod: 'EDR-initiated' },
      });
    }
    
    return {
      success: true,
      output: result,
    };
  }
};

// --- Memory Forensics: Analyze Memory Dump ---
const AnalyzeMemoryDumpAction: Action = {
  id: 'analyze_memory_dump',
  name: 'Forensics: Analyze Memory Dump',
  description: 'Perform forensic analysis on memory dump and extract artifacts',
  version: '1.0.0',
  schema: {
    type: 'object',
    properties: {
      dumpId: { type: 'string', description: 'Memory dump identifier' },
      caseId: { type: 'string', description: 'Associated case ID' },
    },
    required: ['dumpId', 'caseId']
  },
  execute: async (ctx: ActionContext): Promise<ActionResult> => {
    const { ForensicsService } = await import('../services/forensics.service');
    
    const { dumpId, caseId } = ctx.inputs;
    
    const analysis = await ForensicsService.analyzeMemoryDump(dumpId, caseId);
    
    return {
      success: true,
      output: {
        summary: analysis.summary,
        findings: analysis.findings,
        iocs: analysis.iocs,
        recommendations: analysis.recommendations,
      },
    };
  }
};

// --- Register All ---
export function registerBuiltInActions() {
    ActionRegistry.register(BlockIPAction);
    ActionRegistry.register(SendEmailAction);
    
    // EDR Actions
    ActionRegistry.register(CrowdStrikeIsolateHostAction);
    ActionRegistry.register(CrowdStrikeLiftContainmentAction);
    ActionRegistry.register(SentinelOneQuarantineHostAction);
    ActionRegistry.register(SentinelOneUnquarantineHostAction);
    ActionRegistry.register(SentinelOneBlocklistHashAction);
    
    // Forensics Actions
    ActionRegistry.register(CaptureMemoryDumpAction);
    ActionRegistry.register(AnalyzeMemoryDumpAction);
}
