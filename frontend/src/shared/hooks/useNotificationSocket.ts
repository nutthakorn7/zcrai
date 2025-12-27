import { useEffect, useState, useRef } from 'react';
import { useAuth } from '../store/useAuth';

export interface NotificationEvent {
    id: string;
    type: string;
    title: string;
    message: string;
    createdAt: string;
    metadata?: any;
    [key: string]: any;
}

export const useNotificationSocket = () => {
    const { user } = useAuth();
    const [lastNotification, setLastNotification] = useState<NotificationEvent | null>(null);
    const [isConnected, setIsConnected] = useState(false);
    const ws = useRef<WebSocket | null>(null);

    useEffect(() => {
        if (!user?.tenantId || !user?.id) return;

        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const host = window.location.host;
        // Include userId in connection to subscribe to private room
        const wsUrl = `${protocol}//${host}/realtime/alerts?tenantId=${user.tenantId}&userId=${user.id}`;

        console.log(`[NotificationSocket] Connecting to ${wsUrl}`);
        ws.current = new WebSocket(wsUrl);

        ws.current.onopen = () => {
            console.log('[NotificationSocket] Connected');
            setIsConnected(true);
        };

        ws.current.onmessage = (event) => {
            try {
                const message = JSON.parse(event.data);
                if (message.type === 'new_notification') {
                    console.log('[NotificationSocket] New notification:', message.data.title);
                    setLastNotification(message.data);
                }
            } catch (e) {
                console.error('[NotificationSocket] Parse Error', e);
            }
        };

        ws.current.onclose = () => {
            console.log('[NotificationSocket] Disconnected');
            setIsConnected(false);
        };

        ws.current.onerror = (err) => {
            console.error('[NotificationSocket] Error:', err);
        };

        return () => {
            ws.current?.close();
        };
    }, [user?.tenantId, user?.id]);

    return { lastNotification, isConnected };
};
