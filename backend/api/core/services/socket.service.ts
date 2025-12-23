/**
 * Socket Service
 * Utility for broadcasting events via Elysia WebSockets
 */

import type { Elysia } from 'elysia';

let elysiaApp: any = null;

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
  }
};
