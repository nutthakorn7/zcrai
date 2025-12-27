import { api } from './api';

export const AIAPI = {
    chat: (messages: any[], context?: string) => api.post('/ai/chat', { messages, context }),
    streamChat: (messages: any[], context: string, onChunk: (chunk: string) => void) => {
        const url = `${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/ai/stream?messages=${encodeURIComponent(JSON.stringify(messages))}&context=${encodeURIComponent(context || '')}`;
        const eventSource = new EventSource(url, { withCredentials: true });
        
        eventSource.onmessage = (event) => {
            onChunk(event.data);
        };

        eventSource.onerror = (error) => {
            console.error('SSE Error:', error);
            eventSource.close();
            onChunk(' [Error: Connection failed]');
        };

        return () => eventSource.close();
    },
    generateQuery: (prompt: string) => api.post('/ai/query', { prompt }),
};
