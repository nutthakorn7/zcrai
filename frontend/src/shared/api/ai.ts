import { api } from './api';

export const AIAPI = {
    chat: (messages: any[], context?: string) => api.post('/ai/chat', { messages, context }),
    generateQuery: (prompt: string) => api.post('/ai/query', { prompt }),
};
