import { SoarService } from './backend/api/core/services/soar.service'

async function testSoar() {
  console.log('--- Testing SoarService Execution ---');
  
  try {
    const result = await SoarService.execute({
      tenantId: '00000000-0000-0000-0000-000000000001', // Example tenant
      actionType: 'BLOCK_IP',
      provider: 'sentinelone',
      target: '1.2.3.4',
      triggeredBy: 'ai'
    });
    
    console.log('✅ Action Result:', result);
    
    // Check database
    const actions = await SoarService.listActions('00000000-0000-0000-0000-000000000001', 1);
    console.log('✅ Last Action Log:', JSON.stringify(actions[0], null, 2));
    
  } catch (error) {
    console.error('❌ Test Failed:', error);
  }
}

// testSoar();
console.log('Validation script ready. Run with: bun backend/api/core/services/soar.service.ts (if exported) or similar');
