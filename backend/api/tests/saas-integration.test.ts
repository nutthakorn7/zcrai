import { describe, it, expect, spyOn, mock } from 'bun:test';
import { CloudIntegrationService } from '../core/services/cloud-integration.service';
import { EncryptionUtils } from '../core/utils/encryption';

describe('SaaS Integration Service (M365)', () => {
    
    spyOn(EncryptionUtils, 'decrypt').mockReturnValue('real-secret');

    it('should test M365 connection via Graph API', async () => {
        const credentials = { clientId: 'client-123', clientSecret: 'iv:encrypted' };
        const config = { tenantId: 'tenant-456' };

        // Mock Fetch
        global.fetch = mock(async (url: string | URL | Request) => {
             // Verify URL
             if (url.toString().includes('tenant-456/oauth2/v2.0/token')) {
                 return new Response(JSON.stringify({
                     access_token: 'fake-token',
                     expires_in: 3600
                 }), { status: 200 });
             }
             return new Response('Not Found', { status: 404 });
        }) as any;

        const result = await CloudIntegrationService.testM365Connection(credentials, config);

        expect(result.success).toBe(true);
        expect(result.message).toContain('Connected to M365 Tenant tenant-456');
    });

    it('should handle M365 auth failure', async () => {
        const credentials = { clientId: 'client-123', clientSecret: 'iv:encrypted' };
        const config = { tenantId: 'tenant-456' };

        global.fetch = mock(async () => {
             return new Response(JSON.stringify({
                 error: 'invalid_client',
                 error_description: 'Bad secret'
             }), { status: 400 });
        }) as any;

        const result = await CloudIntegrationService.testM365Connection(credentials, config);

        expect(result.success).toBe(false);
        expect(result.message).toContain('Bad secret');
    });
});
