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

// --- Register All ---
export function registerBuiltInActions() {
    ActionRegistry.register(BlockIPAction);
    ActionRegistry.register(SendEmailAction);
}
