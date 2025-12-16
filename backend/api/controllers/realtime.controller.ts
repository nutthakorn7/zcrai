/**
 * Realtime Controller
 * WebSocket endpoints for real-time collaboration features
 */

import { Elysia, t } from 'elysia';

// Simple in-memory store for presence (In prod, use Redis)
// Map<CaseId, Set<UserId>>
const caseRooms = new Map<string, Set<{ id: string, name: string, email: string }>>();

export const realtimeController = new Elysia({ prefix: '/realtime' })
  /**
   * WebSocket endpoint for case collaboration
   * @route WS /realtime/case/:caseId
   * @access Public (requires query params for auth)
   * @param {string} caseId - Case ID to join
   * @query {string} userId - User ID
   * @query {string} userName - User display name
   * @query {string} userEmail - User email
   * @description Real-time collaboration: presence tracking, typing indicators
   * @events presence - User join/leave notifications
   * @events typing - Typing indicator broadcasts
   */
  .ws('/case/:caseId', {
    params: t.Object({
        caseId: t.String()
    }),
    query: t.Object({
        userId: t.String(),
        userName: t.String(),
        userEmail: t.String()
    }),
    open(ws) {
        const { caseId } = ws.data.params;
        const { userId, userName, userEmail } = ws.data.query;
        
        console.log(`[WS] User ${userName} joined case ${caseId}`);

        if (!caseRooms.has(caseId)) {
            caseRooms.set(caseId, new Set());
        }
        
        const room = caseRooms.get(caseId)!;
        // Remove existing session for same user to avoid dupes
        for (const user of room) {
            if (user.id === userId) room.delete(user);
        }
        
        room.add({ id: userId, name: userName, email: userEmail });

        ws.subscribe(caseId); // Join room
        
        // Broadcast 'presence' event
        ws.publish(caseId, JSON.stringify({
            type: 'presence',
            users: Array.from(room)
        }));

        // Send current state to new user
        ws.send(JSON.stringify({
            type: 'presence',
            users: Array.from(room)
        }));
    },
    message(ws, message: any) {
        const { caseId } = ws.data.params;
        const { userId, userName } = ws.data.query;
        
        // Handle "typing" event
        if (message.type === 'typing') {
            ws.publish(caseId, JSON.stringify({
                type: 'typing',
                user: { id: userId, name: userName },
                isTyping: message.isTyping
            }));
        }
    },
    close(ws) {
        const { caseId } = ws.data.params;
        const { userId, userName } = ws.data.query;
        
        console.log(`[WS] User ${userName} left case ${caseId}`);
        
        const room = caseRooms.get(caseId);
        if (room) {
            for (const user of room) {
                if (user.id === userId) room.delete(user);
            }
            
            // Broadcast update
            ws.publish(caseId, JSON.stringify({
                type: 'presence',
                users: Array.from(room)
            }));

            if (room.size === 0) caseRooms.delete(caseId);
        }
        
        ws.unsubscribe(caseId);
    }
  });
