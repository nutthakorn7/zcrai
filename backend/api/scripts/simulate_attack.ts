
import { db } from '../infra/db';
import { alerts, observables, soarActions, tenants } from '../infra/db/schema';
import { AITriageService } from '../core/services/ai-triage.service';
import { v4 as uuidv4 } from 'uuid';
import { eq, desc } from 'drizzle-orm';

async function main() {
  console.log('🚀 Starting Phase 3 Simulation: Critical Attack Response');

  // 0. Get Valid Tenant
  const tenant = await db.query.tenants.findFirst();
  if (!tenant) throw new Error('No Tenant found in DB');
  const tenantId = tenant.id;
  console.log(`🏢 Using Tenant ID: ${tenantId}`);

  // 1. Create Simulated Critical Alert
  const alertId = uuidv4();
  const maliciousIP = '185.193.88.22'; // Known malicious IP example

  console.log(`📝 Creating Mock Alert (ID: ${alertId})...`);
  
  await db.insert(alerts).values({
    id: alertId,
    fingerprint: `sim-fingerprint-${Date.now()}`,
    tenantId,
    title: 'Simulated: Brute Force Attack from Malicious IP',
    description: 'Detected multiple failed login attempts followed by a successful login from a high-risk IP address known for brute force campaigns.',
    severity: 'critical',
    status: 'new',
    source: 'simulation_engine',
    aiTriageStatus: 'pending',
    rawData: {
      event_type: 'brute_force',
      source_ip: maliciousIP,
      dest_ip: '10.0.0.5',
      user_name: 'admin'
    }
  });

  // 2. Add Observable
  await db.insert(observables).values({
    id: uuidv4(),
    tenantId,
    alertId,
    type: 'ip',
    value: maliciousIP,
    isMalicious: true,
    enrichmentData: {
      virustotal: { malicious_count: 55, total_votes: 100 },
      abuseipdb: { abuseConfidenceScore: 100, isp: 'AbuseISP' }
    }
  });

  console.log('✅ Alert Created. Triggering AI Triage...');

  // 3. Trigger AI Triage
  const alert = await db.query.alerts.findFirst({
    where: eq(alerts.id, alertId),
    with: { observables: true }
  });

  if (!alert) throw new Error('Alert not found after insert');

  const analysis = await AITriageService.analyze(alertId, alert);
  
  console.log('🤖 AI Analysis Completed:');
  console.log(JSON.stringify(analysis, null, 2));

  // 4. Verify SOAR Action
  console.log('🔍 Verifying Automated Response (SOAR)...');
  
  // Wait a moment for async actions
  await new Promise(resolve => setTimeout(resolve, 2000));

  const actions = await db.select().from(soarActions)
    .where(eq(soarActions.alertId, alertId))
    .orderBy(desc(soarActions.createdAt));

  if (actions.length > 0) {
    console.log(`🎉 SUCCESS: Found ${actions.length} SOAR Action(s)!`);
    actions.forEach(a => {
      console.log(`- [${a.actionType}] Target: ${a.target} (Status: ${a.status})`);
    });
  } else {
    console.error('❌ FAILURE: No SOAR actions found. Autopilot might be disabled or threshold not met.');
  }

  process.exit(0);
}

main().catch(err => {
  console.error('Simulation Failed:', err);
  process.exit(1);
});
