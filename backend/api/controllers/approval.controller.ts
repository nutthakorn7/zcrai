/**
 * Approval Queue Controller
 * API endpoints for Human-in-the-Loop approval workflow
 */

import { Elysia, t } from 'elysia';
import { ApprovalQueueService } from '../core/services/approval-queue.service';

export const approvalController = new Elysia({ prefix: '/approvals' })
  
  // Get pending approvals for current tenant
  .get('/pending', async ({ store }) => {
    const { user } = store as any;
    if (!user?.tenantId) {
      return { error: 'Unauthorized', status: 401 };
    }
    
    const pending = ApprovalQueueService.getPendingApprovals(user.tenantId);
    return {
      count: pending.length,
      requests: pending.map(req => ({
        id: req.id,
        actionType: req.actionType,
        actionParams: req.actionParams,
        context: req.context,
        requestedBy: req.requestedBy,
        requestedAt: req.requestedAt.toISOString(),
        expiresAt: req.expiresAt.toISOString()
      }))
    };
  })
  
  // Get approval statistics
  .get('/stats', async ({ store }) => {
    const { user } = store as any;
    if (!user?.tenantId) {
      return { error: 'Unauthorized', status: 401 };
    }
    
    return ApprovalQueueService.getStats(user.tenantId);
  })
  
  // Approve a request
  .post('/:id/approve', async ({ params, body, store }) => {
    const { user } = store as any;
    if (!user?.id) {
      return { error: 'Unauthorized', status: 401 };
    }
    
    const { id } = params;
    const { notes } = body as any || {};
    
    const result = await ApprovalQueueService.approve(id, user.id, notes);
    
    if (!result.success) {
      return { error: result.error, status: 400 };
    }
    
    // Execute the approved action
    if (result.action) {
      try {
        // Dynamic import to avoid circular dependencies
        const { ActionRegistry } = await import('../core/actions/registry');
        const action = await ActionRegistry.getAction(result.action.actionType);
        
        if (action) {
          await action.execute({
            tenantId: result.action.tenantId,
            userId: user.id,
            inputs: result.action.actionParams
          });
        }
      } catch (e) {
        console.error(`[Approval] Failed to execute action: ${(e as Error).message}`);
      }
    }
    
    return { 
      success: true, 
      message: `Request ${id} approved`,
      action: result.action?.actionType
    };
  }, {
    body: t.Optional(t.Object({
      notes: t.Optional(t.String())
    }))
  })
  
  // Reject a request
  .post('/:id/reject', async ({ params, body, store }) => {
    const { user } = store as any;
    if (!user?.id) {
      return { error: 'Unauthorized', status: 401 };
    }
    
    const { id } = params;
    const { notes } = body as any || {};
    
    const result = await ApprovalQueueService.reject(id, user.id, notes);
    
    if (!result.success) {
      return { error: result.error, status: 400 };
    }
    
    return { 
      success: true, 
      message: `Request ${id} rejected`
    };
  }, {
    body: t.Optional(t.Object({
      notes: t.Optional(t.String())
    }))
  })
  
  // Submit a new approval request (for manual actions)
  .post('/request', async ({ body, store }) => {
    const { user } = store as any;
    if (!user?.tenantId) {
      return { error: 'Unauthorized', status: 401 };
    }
    
    const { actionType, actionParams, reason, riskLevel, alertId, caseId } = body as any;
    
    // Check if approval is required
    if (!ApprovalQueueService.requiresApproval(actionType, riskLevel || 'high')) {
      return { 
        success: true, 
        requiresApproval: false,
        message: 'Action does not require approval'
      };
    }
    
    const request = await ApprovalQueueService.requestApproval(
      user.tenantId,
      actionType,
      actionParams,
      {
        reason: reason || 'Manual action request',
        riskLevel: riskLevel || 'high',
        alertId,
        caseId
      },
      'analyst'
    );
    
    return {
      success: true,
      requiresApproval: true,
      requestId: request.id,
      expiresAt: request.expiresAt.toISOString()
    };
  }, {
    body: t.Object({
      actionType: t.String(),
      actionParams: t.Any(),
      reason: t.Optional(t.String()),
      riskLevel: t.Optional(t.Union([
        t.Literal('low'),
        t.Literal('medium'),
        t.Literal('high'),
        t.Literal('critical')
      ])),
      alertId: t.Optional(t.String()),
      caseId: t.Optional(t.String())
    })
  });

export default approvalController;
