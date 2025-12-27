/**
 * Socket Service
 * Utility for broadcasting events via Elysia WebSockets
 */

import type { Elysia } from 'elysia';

let elysiaApp: any = null;

// Event Types
export const SOCKET_EVENTS = {
  // Alert Events
  NEW_ALERT: 'NEW_ALERT',
  ALERT_UPDATED: 'ALERT_UPDATED',
  ALERT_ASSIGNED: 'ALERT_ASSIGNED',
  
  // Investigation Events
  INVESTIGATION_STARTED: 'INVESTIGATION_STARTED',
  INVESTIGATION_ROUND: 'INVESTIGATION_ROUND',
  INVESTIGATION_FINDING: 'INVESTIGATION_FINDING',
  INVESTIGATION_COMPLETED: 'INVESTIGATION_COMPLETED',
  
  // Case Events
  NEW_CASE: 'NEW_CASE',
  CASE_UPDATED: 'CASE_UPDATED',
  
  // Dashboard Stats
  STATS_UPDATE: 'STATS_UPDATE',
  
  // Integration Health
  INTEGRATION_STATUS: 'INTEGRATION_STATUS'
} as const;

export const SocketService = {
  /**
   * Register the app instance for broadcasting
   * @param app Elysia instance
   */
  register(app: any) {
    elysiaApp = app;
    console.log('✅ SocketService registered with Elysia app');
  },

  /**
   * Broadcast an event to a specific room (e.g., tenantId)
   * @param room Tenant ID or room name
   * @param event Event type
   * @param data Payload
   */
  broadcast(room: string, event: string, data: any) {
    if (!elysiaApp?.server) {
        console.warn('⚠️ SocketService: App server not initialized. Cannot broadcast.');
        return;
    }

    const payload = JSON.stringify({
      type: event,
      data,
      timestamp: new Date().toISOString()
    });

    console.log(`[Socket] Broadcasting ${event} to room ${room}`);
    elysiaApp.server.publish(room, payload);
  },

  /**
   * Send a message to all connected clients (Global)
   * @param event Event type
   * @param data Payload
   */
  broadcastGlobal(event: string, data: any) {
    if (!elysiaApp?.server) return;

    const payload = JSON.stringify({
      type: event,
      data,
      timestamp: new Date().toISOString()
    });

    console.log(`[Socket] Broadcasting global ${event}`);
    elysiaApp.server.publish('global', payload);
  },

  // ==================== Dashboard Event Helpers ====================

  /**
   * Notify dashboard of new alert
   */
  notifyNewAlert(tenantId: string, alert: any) {
    this.broadcast(tenantId, SOCKET_EVENTS.NEW_ALERT, {
      id: alert.id,
      title: alert.title,
      severity: alert.severity,
      status: alert.status,
      createdAt: alert.createdAt
    });
  },

  /**
   * Notify dashboard of alert update
   */
  notifyAlertUpdated(tenantId: string, alertId: string, changes: any) {
    this.broadcast(tenantId, SOCKET_EVENTS.ALERT_UPDATED, {
      id: alertId,
      changes
    });
  },

  /**
   * Push investigation status in real-time
   */
  notifyInvestigationStatus(tenantId: string, alertId: string, status: {
    phase: 'started' | 'round' | 'finding' | 'completed';
    round?: number;
    maxRounds?: number;
    message: string;
    finding?: any;
  }) {
    const eventType = status.phase === 'started' ? SOCKET_EVENTS.INVESTIGATION_STARTED
      : status.phase === 'round' ? SOCKET_EVENTS.INVESTIGATION_ROUND
      : status.phase === 'finding' ? SOCKET_EVENTS.INVESTIGATION_FINDING
      : SOCKET_EVENTS.INVESTIGATION_COMPLETED;

    this.broadcast(tenantId, eventType, {
      alertId,
      ...status
    });
  },

  /**
   * Notify dashboard of new case creation
   */  
  notifyNewCase(tenantId: string, caseData: any) {
    this.broadcast(tenantId, SOCKET_EVENTS.NEW_CASE, {
      id: caseData.id,
      title: caseData.title,
      severity: caseData.severity,
      status: caseData.status
    });
  },

  /**
   * Push dashboard stats update
   */
  notifyStatsUpdate(tenantId: string, stats: any) {
    this.broadcast(tenantId, SOCKET_EVENTS.STATS_UPDATE, stats);
  },

  /**
   * Push integration health status
   */
  notifyIntegrationStatus(tenantId: string, integration: string, status: 'healthy' | 'degraded' | 'down') {
    this.broadcast(tenantId, SOCKET_EVENTS.INTEGRATION_STATUS, {
      integration,
      status,
      checkedAt: new Date().toISOString()
    });
  }
};
