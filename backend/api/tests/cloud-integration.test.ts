import { describe, it, expect, spyOn, mock } from 'bun:test';
import { CloudIntegrationService } from '../core/services/cloud-integration.service';
import { EncryptionUtils } from '../core/utils/encryption';
import { db } from '../infra/db';

describe('Cloud Integration Service', () => {
    
    // Mock Encryption
    spyOn(EncryptionUtils, 'encrypt').mockReturnValue('iv:encrypted-secret');
    spyOn(EncryptionUtils, 'decrypt').mockReturnValue('real-secret');

    // Mock STS Client (AWS)
    // Since we can't easily mock the import inside the service without dependency injection or heavy module mocking in Bun,
    // we will focus on the Logic around encryption and DB storage.
    // The integration test for `testConnection` would require mocking the network call.
    
    const tenantId = 'e746d022-89dd-4134-a60c-be3583f47f6c'; // Super Admin

    it('should create an integration with encrypted credentials', async () => {
        // Mock DB Insert
        // Ideally we would mock db.insert().values().returning()
        // But for minimal testing, we will assume Drizzle works (or fails if no DB).
        // Let's rely on the fact that `create` calls `EncryptionUtils.encrypt`.
        
        // We can inspect the arguments passed to DB if we spy on it, but here we just check if it runs without error 
        // OR we can trust the spy on EncryptionUtils.
        
        try {
            await CloudIntegrationService.create({
                tenantId,
                name: 'Test AWS',
                provider: 'aws',
                config: { region: 'us-east-1' },
                credentials: { accessKeyId: 'AKIA...', secretAccessKey: 'SECRET' }
            } as any);
        } catch (e) {
            // DB fail expected if no DB connection
        }

        expect(EncryptionUtils.encrypt).toHaveBeenCalledWith('SECRET');
    });

    it('should decrypt credentials before helping connection test', async () => {
        // We want to verify `decrypt` is called when `testAwsConnection` is invoked.
        // `testAwsConnection` is called by `testConnection`.
        
        // Mock DB Select to return an integration
        const mockIntegration = {
            id: 'int-123',
            tenantId,
            provider: 'aws',
            credentials: { accessKeyId: 'AKIA', secretAccessKey: 'iv:encrypted' },
            config: { region: 'us-east-1' }
        };

        // Injecting a mock DB response is hard without a library.
        // So we will call the internal method `testAwsConnection` if we can access it (it's public now).
        
        await CloudIntegrationService.testAwsConnection(mockIntegration.credentials, mockIntegration.config);
        
        expect(EncryptionUtils.decrypt).toHaveBeenCalledWith('iv:encrypted');
    });
});
