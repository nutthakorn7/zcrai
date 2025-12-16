import { useEffect, useState, useRef, useCallback } from 'react';
import { useAuth } from '../store/useAuth';

export interface ConnectedUser {
    id: string;
    name: string;
    email: string;
}

export const useCaseSocket = (caseId: string) => {
    const { user } = useAuth();
    const ws = useRef<WebSocket | null>(null);
    const [activeUsers, setActiveUsers] = useState<ConnectedUser[]>([]);
    const [typingUsers, setTypingUsers] = useState<string[]>([]); // Names of typing users

    useEffect(() => {
        if (!caseId || !user) return;

        // Construct WS URL
        // In prod: wss://path/realtime...
        // Assuming API URL is stored in env or hardcoded relative to current window
        // For this env: wss://45.118.132.160:3002/realtime/case/... or similar
        // Ideally use import.meta.env.VITE_WS_URL but I'll derive from API URL logic
        
        const wsUrl = `ws://45.118.132.160:3002/realtime/case/${caseId}?userId=${user.id}&userName=${encodeURIComponent(user.email)}&userEmail=${encodeURIComponent(user.email)}`;
        
        ws.current = new WebSocket(wsUrl);

        ws.current.onopen = () => {

        };

        ws.current.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                
                if (data.type === 'presence') {
                    setActiveUsers(data.users);
                }
                
                if (data.type === 'typing') {
                    if (data.isTyping) {
                        setTypingUsers(prev => [...prev.filter(name => name !== data.user.name), data.user.name]);
                    } else {
                        setTypingUsers(prev => prev.filter(name => name !== data.user.name));
                    }
                }
            } catch (e) {
                console.error('WS Parse Error', e);
            }
        };

        ws.current.onclose = () => {

        };

        return () => {
            ws.current?.close();
        };
    }, [caseId, user]);

    const emitTyping = useCallback((isTyping: boolean) => {
        if (ws.current?.readyState === WebSocket.OPEN) {
            ws.current.send(JSON.stringify({ type: 'typing', isTyping }));
        }
    }, []);

    return { activeUsers, typingUsers, emitTyping };
};
