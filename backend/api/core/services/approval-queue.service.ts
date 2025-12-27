/**
 * Human-in-the-Loop Approval Queue Service
 * Manages approval workflow for sensitive SOAR actions
 */

import { db } from '../../infra/db';
import { SocketService } from './socket.service';

// Approval Request Status
export type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'expired';

// Approval Request Structure
export interface ApprovalRequest {
  id: string;
  tenantId: string;
  actionType: string;
  actionParams: any;
  context: {
    alertId?: string;
    caseId?: string;
    reason: string;
    riskLevel: 'low' | 'medium' | 'high' | 'critical';
    aiRecommendation?: string;
  };
  requestedBy: 'ai_agent' | 'analyst';
  requestedAt: Date;
  status: ApprovalStatus;
  reviewedBy?: string;
  reviewedAt?: Date;
  reviewNotes?: string;
  expiresAt: Date;
}

// In-memory queue (in production, use Redis or DB)
const approvalQueue: Map<string, ApprovalRequest> = new Map();

// Actions that require approval
const SENSITIVE_ACTIONS = [
  'block_ip',
  'isolate_host',
  'disable_user',
  'quarantine_file',
  'terminate_process',
  'revoke_session'
];

// Risk level thresholds for auto-approval
const AUTO_APPROVE_THRESHOLDS: Record<string, 'low' | 'medium'> = {
  'block_ip': 'low',        // Only auto-approve low-risk IP blocks
  'isolate_host': 'low',    // Never auto-approve host isolation
  'disable_user': 'low',    // Never auto-approve user disabling
  'quarantine_file': 'medium',
  'terminate_process': 'medium',
  'revoke_session': 'medium'
};

export class ApprovalQueueService {
  
  /**
   * Check if an action requires human approval
   */
  static requiresApproval(actionType: string, riskLevel: string): boolean {
    if (!SENSITIVE_ACTIONS.includes(actionType)) {
      return false;
    }
    
    const threshold = AUTO_APPROVE_THRESHOLDS[actionType];
    
    // Auto-approve if risk level is at or below threshold
    if (threshold === 'medium' && (riskLevel === 'low' || riskLevel === 'medium')) {
      return false;
    }
    if (threshold === 'low' && riskLevel === 'low') {
      return false;
    }
    
    return true;
  }

  /**
   * Submit an action for approval
   */
  static async requestApproval(
    tenantId: string,
    actionType: string,
    actionParams: any,
    context: ApprovalRequest['context'],
    requestedBy: 'ai_agent' | 'analyst' = 'ai_agent'
  ): Promise<ApprovalRequest> {
    const id = `apr_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24); // 24 hour expiry
    
    const request: ApprovalRequest = {
      id,
      tenantId,
      actionType,
      actionParams,
      context,
      requestedBy,
      requestedAt: new Date(),
      status: 'pending',
      expiresAt
    };
    
    approvalQueue.set(id, request);
    
    console.log(`[ApprovalQueue] New request ${id}: ${actionType} (${context.riskLevel} risk)`);
    
    // Notify analysts via WebSocket
    SocketService.broadcast(tenantId, 'APPROVAL_REQUESTED', {
      id,
      actionType,
      riskLevel: context.riskLevel,
      reason: context.reason,
      alertId: context.alertId,
      expiresAt: expiresAt.toISOString()
    });
    
    return request;
  }

  /**
   * Get pending approvals for a tenant
   */
  static getPendingApprovals(tenantId: string): ApprovalRequest[] {
    const now = new Date();
    return Array.from(approvalQueue.values())
      .filter(req => req.tenantId === tenantId && req.status === 'pending')
      .filter(req => req.expiresAt > now)
      .sort((a, b) => {
        // Sort by risk level (critical first) then by time
        const riskOrder = { critical: 0, high: 1, medium: 2, low: 3 };
        const riskDiff = riskOrder[a.context.riskLevel] - riskOrder[b.context.riskLevel];
        if (riskDiff !== 0) return riskDiff;
        return b.requestedAt.getTime() - a.requestedAt.getTime();
      });
  }

  /**
   * Approve a request
   */
  static async approve(
    requestId: string,
    reviewedBy: string,
    notes?: string
  ): Promise<{ success: boolean; error?: string; action?: ApprovalRequest }> {
    const request = approvalQueue.get(requestId);
    
    if (!request) {
      return { success: false, error: 'Request not found' };
    }
    
    if (request.status !== 'pending') {
      return { success: false, error: `Request already ${request.status}` };
    }
    
    if (request.expiresAt < new Date()) {
      request.status = 'expired';
      return { success: false, error: 'Request expired' };
    }
    
    request.status = 'approved';
    request.reviewedBy = reviewedBy;
    request.reviewedAt = new Date();
    request.reviewNotes = notes;
    
    console.log(`[ApprovalQueue] Request ${requestId} APPROVED by ${reviewedBy}`);
    
    // Notify via WebSocket
    SocketService.broadcast(request.tenantId, 'APPROVAL_RESOLVED', {
      id: requestId,
      status: 'approved',
      reviewedBy,
      actionType: request.actionType
    });
    
    return { success: true, action: request };
  }

  /**
   * Reject a request
   */
  static async reject(
    requestId: string,
    reviewedBy: string,
    notes?: string
  ): Promise<{ success: boolean; error?: string }> {
    const request = approvalQueue.get(requestId);
    
    if (!request) {
      return { success: false, error: 'Request not found' };
    }
    
    if (request.status !== 'pending') {
      return { success: false, error: `Request already ${request.status}` };
    }
    
    request.status = 'rejected';
    request.reviewedBy = reviewedBy;
    request.reviewedAt = new Date();
    request.reviewNotes = notes;
    
    console.log(`[ApprovalQueue] Request ${requestId} REJECTED by ${reviewedBy}`);
    
    // Notify via WebSocket
    SocketService.broadcast(request.tenantId, 'APPROVAL_RESOLVED', {
      id: requestId,
      status: 'rejected',
      reviewedBy,
      reason: notes
    });
    
    return { success: true };
  }

  /**
   * Get approval statistics
   */
  static getStats(tenantId: string): {
    pending: number;
    approved: number;
    rejected: number;
    expired: number;
    avgApprovalTimeMs: number;
  } {
    const requests = Array.from(approvalQueue.values())
      .filter(req => req.tenantId === tenantId);
    
    const approved = requests.filter(r => r.status === 'approved');
    const approvalTimes = approved
      .filter(r => r.reviewedAt)
      .map(r => r.reviewedAt!.getTime() - r.requestedAt.getTime());
    
    return {
      pending: requests.filter(r => r.status === 'pending').length,
      approved: approved.length,
      rejected: requests.filter(r => r.status === 'rejected').length,
      expired: requests.filter(r => r.status === 'expired').length,
      avgApprovalTimeMs: approvalTimes.length > 0 
        ? approvalTimes.reduce((a, b) => a + b, 0) / approvalTimes.length 
        : 0
    };
  }

  /**
   * Wait for approval (with timeout)
   */
  static async waitForApproval(requestId: string, timeoutMs: number = 300000): Promise<{
    approved: boolean;
    timedOut: boolean;
    request: ApprovalRequest | null;
  }> {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeoutMs) {
      const request = approvalQueue.get(requestId);
      
      if (!request) {
        return { approved: false, timedOut: false, request: null };
      }
      
      if (request.status === 'approved') {
        return { approved: true, timedOut: false, request };
      }
      
      if (request.status === 'rejected' || request.status === 'expired') {
        return { approved: false, timedOut: false, request };
      }
      
      // Wait 5 seconds before checking again
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
    
    return { approved: false, timedOut: true, request: approvalQueue.get(requestId) || null };
  }

  /**
   * Clean up expired requests
   */
  static cleanupExpired(): number {
    const now = new Date();
    let cleaned = 0;
    
    for (const [id, request] of approvalQueue.entries()) {
      if (request.status === 'pending' && request.expiresAt < now) {
        request.status = 'expired';
        cleaned++;
      }
    }
    
    return cleaned;
  }
}

// Run cleanup every hour
setInterval(() => {
  const cleaned = ApprovalQueueService.cleanupExpired();
  if (cleaned > 0) {
    console.log(`[ApprovalQueue] Cleaned up ${cleaned} expired requests`);
  }
}, 3600000);

console.log('[ApprovalQueue] Service initialized');
