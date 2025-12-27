
import { db } from '../infra/db';
import { alerts, observables, aiFeedback, tenants, users } from '../infra/db/schema';
import { AITriageService } from '../core/services/ai-triage.service';
import { AIFeedbackService } from '../core/services/ai-feedback.service';
import { v4 as uuidv4 } from 'uuid';
import { eq } from 'drizzle-orm';

async function main() {
  console.log('🚀 Starting Phase 4 Simulation: Feedback Loop (RAG Learning)');

  // 0. Get Valid Tenant & User
  const tenant = await db.query.tenants.findFirst();
  if (!tenant) throw new Error('No Tenant found in DB');
  const tenantId = tenant.id;

  const user = await db.query.users.findFirst();
  if (!user) throw new Error('No User found in DB (Needed for feedback)');
  const userId = user.id;
  
  console.log(`🏢 Using Tenant ID: ${tenantId}, User ID: ${userId}`);

  // --- SCENARIO: Server Maintenance Script ---
  const alertTitle = 'Powershell execution with encoded command';
  const alertDesc = 'Detected powershell.exe executing base64 encoded command on Production-DB-01. Suspicious activity.';
  
  // 1. Create ALERT A (Initial Mistake)
  const alertIdA = uuidv4();
  console.log(`\n--- [Step 1] Creating Alert A (ID: ${alertIdA}) ---`);
  
  await db.insert(alerts).values({
    id: alertIdA,
    tenantId,
    title: alertTitle,
    description: alertDesc,
    severity: 'medium',
    status: 'new',
    source: 'simulation_engine',
    aiTriageStatus: 'pending',
    fingerprint: `sim-feedback-A-${Date.now()}`,
    rawData: {
        host_name: 'Production-DB-01',
        process_name: 'powershell.exe',
        command_line: 'powershell -enc aGVsbG8gd29ybGQ=' // "hello world"
    }
  });

  // Trigger Analysis A
  const alertA = await db.query.alerts.findFirst({ where: eq(alerts.id, alertIdA), with: { observables: true } });
  if (!alertA) throw new Error("Alert A creation failed");

  console.log('🤖 Triggering AI Analysis A (Expecting Suspicious)...');
  const analysisA = await AITriageService.analyze(alertIdA, alertA);
  console.log('Analysis A Result:', analysisA.classification);

  // 2. Submit FEEDBACK (Correction)
  console.log(`\n--- [Step 2] Submitting Feedback (Correction) ---`);
  console.log('Analyst says: "This is a weekly maintenance script, safe."');
  
  await AIFeedbackService.submitFeedback(tenantId, alertIdA, userId, {
      rating: 0, // Incorrect
      comment: 'False Positive. Verified as weekly maintenance script run by admin.'
  });
  
  console.log('✅ Feedback submitted & RAG updated.');
  
  // Wait for embedding to settle AND avoid Gemini Rate Limits (Free Tier is restrictive)
  console.log('⏳ Waiting 60s to respect API Rate Limits/Quotas...');
  await new Promise(r => setTimeout(r, 60000));

  // 3. Create ALERT B (Similar Event)
  const alertIdB = uuidv4();
  console.log(`\n--- [Step 3] Creating Alert B (Similar Event) ---`);
  
  await db.insert(alerts).values({
    id: alertIdB,
    tenantId,
    title: alertTitle, // Same title
    description: alertDesc, // Same description
    severity: 'medium',
    status: 'new',
    source: 'simulation_engine',
    aiTriageStatus: 'pending',
    fingerprint: `sim-feedback-B-${Date.now()}`,
    rawData: {
        host_name: 'Production-DB-01',
        process_name: 'powershell.exe',
        command_line: 'powershell -enc bmV4dCBjb21tYW5k' // different command payload
    }
  });

  const alertB = await db.query.alerts.findFirst({ where: eq(alerts.id, alertIdB), with: { observables: true } });
  if (!alertB) throw new Error("Alert B creation failed");

  console.log('🤖 Triggering AI Analysis B (Expecting Learning)...');
  const analysisB = await AITriageService.analyze(alertIdB, alertB);
  
  console.log('Analysis B Result:', analysisB.classification);
  console.log('Reasoning:', analysisB.reasoning);

  // 4. Verification Logic
  if (analysisB.classification === 'FALSE_POSITIVE' || analysisB.reasoning.toLowerCase().includes('maintenance') || analysisB.reasoning.toLowerCase().includes('known safe')) {
      console.log('\n🎉 SUCCESS: AI Learned from feedback!');
  } else {
      console.log('\n❌ FAILURE: AI did not adapting (Verdict remained same without citing feedback).');
  }

  process.exit(0);
}

main().catch(err => {
  console.error('Feedback Simulation Failed:', err);
  process.exit(1);
});
