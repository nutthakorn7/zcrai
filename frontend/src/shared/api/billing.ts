import { api } from './api';

export const BillingAPI = {
    getSubscription: async () => {
        const response = await api.get('/billing');
        return response.data;
    },
    subscribe: async (tier: 'free' | 'pro' | 'enterprise') => {
        const response = await api.post('/billing/subscribe', { tier });
        return response.data;
    }
};
