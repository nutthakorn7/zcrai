
import { DetectionService } from './core/services/detection.service';
import { clickhouse } from './infra/clickhouse/client';
import { db } from './infra/db';
import { detectionRules } from './infra/db/schema';
import { eq } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';

async function run() {
  console.log('🚀 Starting Attack Simulation...');

  // The Tenant ID we found in DB
  const tenantId = '75a8f9a4-a1df-45a8-84c3-b2fa2721934b';
  
  try {
    // 1. Reset Last Run Time of the Rule (to guarantee it picks up new logs)
    console.log('🔄 Resetting rule "last_run_at" to 24 hours ago...');
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
    
    await db.update(detectionRules)
      .set({ lastRunAt: yesterday })
      .where(eq(detectionRules.name, 'Port Scanning Activity'));
      
    console.log('✅ Rule reset.');

    // 2. Insert Fake Log into ClickHouse
    console.log('📝 Inserting fake log into ClickHouse...');
    const eventId = uuidv4();
    const now = new Date();
    // Use ISO string for ClickHouse DateTime
    const timestamp = now.toISOString().slice(0, 19).replace('T', ' ');

    await clickhouse.insert({
      table: 'security_events',
      values: [{
        id: eventId,
        tenant_id: tenantId,
        source: 'simulation_script',
        event_type: 'network_connection', 
        severity: 'high',
        timestamp: timestamp, 
        host_ip: '10.0.0.666', // Evil IP
        network_dst_port: 445,
        user_name: 'hacker',
        file_name: 'malware.exe' // Just in case
      }],
      format: 'JSONEachRow'
    });
    
    console.log(`✅ Log inserted: ${eventId} at ${timestamp}`);
    
    // Wait for ClickHouse ingestion (usually instant but safety first)
    await new Promise(r => setTimeout(r, 2000));

    // 3. Trigger Detection Engine
    console.log('🔍 Triggering Detection Engine...');
    await DetectionService.runAllDueRules();

    console.log('✅ Simulation Complete. Check Alerts table.');
    process.exit(0);

  } catch (e) {
    console.error('❌ Simulation Failed:', e);
    process.exit(1);
  }
}

run();
