import { AITraceService } from './backend/api/core/services/ai-trace.service';
import { db } from './backend/api/infra/db';
import { alerts, tenants } from './backend/api/infra/db/schema';
import { eq } from 'drizzle-orm';

async function verifyAITraces() {
    console.log('--- AI Trace Verification ---');

    // 1. Get a test tenant and alert
    const testTenant = await db.query.tenants.findFirst();
    if (!testTenant) {
        console.error('No tenant found for testing');
        return;
    }

    const testAlert = await db.query.alerts.findFirst({
        where: eq(alerts.tenantId, testTenant.id)
    });

    if (!testAlert) {
        console.error('No alert found for testing');
        return;
    }

    console.log(`Testing with Tenant: ${testTenant.name}, Alert: ${testAlert.title}`);

    // 2. Log a dummy trace
    console.log('Logging mock investigation steps...');
    
    await AITraceService.logTrace({
        tenantId: testTenant.id,
        alertId: testAlert.id,
        agentName: 'Manager',
        thought: 'Verification script starting: Analyzing alert context.',
        action: [{ tool: 'test_tool', reason: 'Verification' }]
    });

    await AITraceService.logTrace({
        tenantId: testTenant.id,
        alertId: testAlert.id,
        agentName: 'NetworkAgent',
        observation: { status: 'clean', ip: '8.8.8.8' }
    });

    // 3. Retrieve and verify
    console.log('Retrieving traces...');
    const traces = await AITraceService.getTracesByAlert(testTenant.id, testAlert.id);
    
    console.log(`Found ${traces.length} traces.`);
    traces.forEach((t, i) => {
        console.log(`[Step ${i}] Agent: ${t.agentName}, Thought: ${t.thought ? 'YES' : 'NO'}, Observation: ${t.observation ? 'YES' : 'NO'}`);
    });

    if (traces.length >= 2) {
        console.log('✅ AI Trace Logging & Retrieval: SUCCESS');
    } else {
        console.log('❌ AI Trace Logging & Retrieval: FAILED');
    }
}

verifyAITraces().catch(console.error);
