import { useEffect, useState, useRef } from 'react';
import { useAuth } from '../store/useAuth';

export interface AlertEvent {
    id: string;
    tenantId: string;
    title: string;
    severity: string;
    source: string;
    createdAt: string;
    [key: string]: any;
}

export const useAlertSocket = () => {
    const { user } = useAuth();
    const [lastAlert, setLastAlert] = useState<AlertEvent | null>(null);
    const [isConnected, setIsConnected] = useState(false);
    const ws = useRef<WebSocket | null>(null);

    useEffect(() => {
        if (!user?.tenantId) return;

        // Use the same IP/Port as useCaseSocket for consistency in this environment
        // In a real production app, this should be derived from import.meta.env.VITE_WS_URL
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const host = '45.118.132.160:3002'; // Hardcoded as per project pattern in useCaseSocket.ts
        const wsUrl = `${protocol}//${host}/realtime/alerts?tenantId=${user.tenantId}`;
        
        console.log(`[Socket] Connecting to ${wsUrl}`);
        ws.current = new WebSocket(wsUrl);

        ws.current.onopen = () => {
            console.log('[Socket] Connected to alerts stream');
            setIsConnected(true);
        };

        ws.current.onmessage = (event) => {
            try {
                const message = JSON.parse(event.data);
                if (message.type === 'new_alert') {
                    console.log('[Socket] New alert received:', message.data.title);
                    setLastAlert(message.data);
                }
            } catch (e) {
                console.error('[Socket] Parse Error', e);
            }
        };

        ws.current.onclose = () => {
            console.log('[Socket] Disconnected from alerts stream');
            setIsConnected(false);
            // Simple exponential backoff or retry can be added here
        };

        ws.current.onerror = (err) => {
            console.error('[Socket] Error:', err);
        };

        return () => {
            ws.current?.close();
        };
    }, [user?.tenantId]);

    return { lastAlert, isConnected };
};
