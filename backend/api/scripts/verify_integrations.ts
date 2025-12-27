
import { IntegrationService } from '../core/services/integration.service';
import { db } from '../infra/db';
import { apiKeys } from '../infra/db/schema';
import { eq } from 'drizzle-orm';
import { Encryption } from '../utils/encryption';

async function main() {
  console.log('🔍 Starting Integration Verification...');

  // 1. Setup Mock User/Tenant
  const tenantId = 'verify-script-tenant';
  const provider = 'mock-provider';
  
  console.log(`\n1️⃣  Setting up mock integration for tenant: ${tenantId}`);

  // Clean up previous runs
  await db.delete(apiKeys).where(eq(apiKeys.tenantId, tenantId));

  // Create a mock enrichment integration (since it's easier to mock test)
  // We'll use a fake API key but mock the fetch in a real scenario, 
  // or we can try to add a real one if we had it, but for now let's just test the flow.
  // We'll use 'abuseipdb' as it requires a key.
  
  // NOTE: This will fail the actual HTTP check if key is invalid, 
  // but we want to verify the Service method executes and tries the HTTP call.
  const mockKey = 'fake-api-key-12345';
  
  // Manually insert to skip the real 'testConnection' check in 'addEnrichment' if strictly needed,
  // but 'addEnrichment' calls 'addEnrichment' service which might not test immediately? 
  // Actually 'addEnrichment' in controller called 'addEnrichment' in service.
  // Service's 'addEnrichment' does NOT call 'testEnrichmentConnection' automatically in the code I verify?
  // Let's check... I saw 'addSentinelOne' calls 'testSentinelOneConnection'.
  // 'addEnrichment' just inserts. So this is safe to call.
  
  const addResult = await IntegrationService.addEnrichment(tenantId, 'abuseipdb', {
      apiKey: mockKey,
      label: 'Mock Verification Integration'
  });
  
  const integrationId = addResult.integration.id;
  console.log(`✅ Integration created with ID: ${integrationId}`);

  // 2. Test 'listForCollector'
  console.log('\n2️⃣  Verifying listForCollector...');
  const collectorList = await IntegrationService.listForCollector('abuseipdb');
  
  const found = collectorList.find(i => i.id === integrationId);
  
  if (found) {
      console.log('✅ Integration found in collector list.');
      // Verify config is decrypted
      const config = JSON.parse(found.config as string);
      if (config.apiKey === mockKey) {
          console.log('✅ Config decrypted correctly in collector list.');
      } else {
          console.error('❌ Config mismatch:', config);
      }
  } else {
      console.error('❌ Integration NOT found in collector list.');
  }

  // 3. Verify 'testExisting'
  console.log(`\n3️⃣  Verifying testExisting for ID: ${integrationId}...`);
  try {
      // This is expected to fail with "Connection Failed" or similar because key is fake,
      // but it confirms the flow works (decrypts and calls fetch).
      await IntegrationService.testExisting(integrationId, tenantId);
      console.log('❓ Unexpected success (did the fake key work?)');
  } catch (e: any) {
      console.log(`✅ testExisting executed and failed as expected with: ${e.message}`);
      // Verify database status update
  }

  // 4. Check DB Status
  console.log('\n4️⃣  Checking DB Status...');
  const keys = await db.select().from(apiKeys).where(eq(apiKeys.id, integrationId));
  const key = keys[0];
  
  console.log(`Status: ${key.lastSyncStatus}`);
  console.log(`Error: ${key.lastSyncError}`);
  
  if (key.lastSyncStatus === 'error') {
      console.log('✅ DB status correctly updated to error.');
  } else {
      console.error('❌ DB status not updated correctly.');
  }

  // Cleanup
  console.log('\n🧹 Cleaning up...');
  await db.delete(apiKeys).where(eq(apiKeys.tenantId, tenantId));
  console.log('✅ Cleanup complete.');
  
  process.exit(0);
}

main().catch(err => {
  console.error('❌ Script failed:', err);
  process.exit(1);
});
