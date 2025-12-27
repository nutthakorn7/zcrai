import { EncryptionUtil } from './backend/api/core/utils/encryption.util';
import { SOARService } from './backend/api/core/services/soar.service';

async function verifySOAR() {
    console.log('--- SOAR Backend Verification ---');

    // 1. Verify Encryption
    const sensitiveData = JSON.stringify({ apiKey: 'secret-12345', url: 'https://api.crowdstrike.com' });
    const encrypted = EncryptionUtil.encrypt(sensitiveData);
    console.log('Encrypted Data:', encrypted);

    const decrypted = EncryptionUtil.decrypt(encrypted);
    console.log('Decrypted Data:', decrypted);

    if (sensitiveData === decrypted) {
        console.log('✅ Encryption/Decryption: SUCCESS');
    } else {
        console.log('❌ Encryption/Decryption: FAILED');
    }

    // 2. Mock Action Execution Logic
    console.log('\nTesting Mock Action Execution...');
    try {
        const result = await SOARService.executeAction('demo-tenant-id', {
            actionType: 'ISOLATE_HOST',
            provider: 'sentinelone',
            target: 'workstation-x',
            userId: 'demo-user'
        });
        console.log('Action Result:', JSON.stringify(result, null, 2));
        console.log('✅ Mock Action Execution: SUCCESS');
    } catch (e) {
        console.error('❌ Mock Action Execution: FAILED', e);
    }
}

verifySOAR();
