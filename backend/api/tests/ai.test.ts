import { describe, expect, it, beforeAll, afterAll } from 'bun:test'
import { app } from '../index'
import { getAuthHeaders } from './setup'

describe('AI Controller Integration', () => {
    let authHeaders: any;

    beforeAll(async () => {
        authHeaders = await getAuthHeaders();
    });

    it('POST /ai/query - should generate SQL and filters', async () => {
        const response = await app.handle(
            new Request('http://localhost/ai/query', {
                method: 'POST',
                headers: {
                    ...authHeaders,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    prompt: 'Show me critical alerts from CrowdStrike'
                })
            })
        );

        expect(response.status).toBe(200);
        const json = await response.json() as { success: boolean, data: any };
        expect(json.success).toBe(true);
        expect(json.data).toHaveProperty('sql');
        expect(json.data).toHaveProperty('filters');
        // We mock the AI service usually, but in integration we might hit a mock provider
        // or check structure.
        // Assuming AI Service is mocked or works.
    });

    it('POST /ai/query - should fail without prompt', async () => {
        const response = await app.handle(
            new Request('http://localhost/ai/query', {
                method: 'POST',
                headers: {
                    ...authHeaders,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({})
            })
        );
        expect(response.status).not.toBe(200);
    });
});
