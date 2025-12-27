import { db } from '../infra/db'; // Assuming access to DB for cleanup if needed, but we'll stick to API
// We will use standard fetch

const BASE_URL = 'http://localhost:8006';
const EMAIL = 'superadmin@zcr.ai';
const PASSWORD = 'SuperAdmin@123!';

async function main() {
    console.log('🚀 Starting Verification: Approval Workflow');

    // 1. Login
    console.log('1. Logging in...');
    const loginRes = await fetch(`${BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: EMAIL, password: PASSWORD })
    });
    
    if (!loginRes.ok) throw new Error(`Login failed: ${await loginRes.text()}`);
    // extract cookie manually if needed, or rely on bun's handling? 
    // fetch in bun doesn't persist cookies automatically across requests unless we use a cookie jar, 
    // but the API might return a set-cookie header.
    // Actually, backend uses HttpOnly cookies. We need to grab the cookie from header and send it back.
    const setCookie = loginRes.headers.get('set-cookie');
    if (!setCookie) throw new Error('No cookie received');
    const cookie = setCookie.split(';')[0];
    
    console.log('✅ Logged in');

    // 2. Create Playbook with Approval Step
    console.log('2. Creating Playbook...');
    const playbookRes = await fetch(`${BASE_URL}/playbooks`, {
        method: 'POST',
        headers: { 
            'Content-Type': 'application/json',
            'Cookie': cookie
        },
        body: JSON.stringify({
            title: 'Test Approval Playbook ' + Date.now(),
            description: 'Testing approval workflow',
            steps: [
                {
                    name: 'Step 1: Manual',
                    type: 'manual',
                    description: 'Do something first'
                },
                {
                    name: 'Step 2: Approval Needed',
                    type: 'approval',
                    description: 'Please approve this action'
                },
                {
                    name: 'Step 3: Automation',
                    type: 'automation',
                    actionId: 'mock_action', // assuming mock_action exists or fails gracefully
                    config: {}
                }
            ]
        })
    });
    let playbookData;
    const clone = playbookRes.clone();
    try {
        playbookData = await playbookRes.json() as any;
    } catch (e) {
        throw new Error(`Failed to parse playbook response (${playbookRes.status}): ${await clone.text()}`);
    }
    if (!playbookData.success) {
        console.error('Create failed:', playbookData);
        throw new Error('Create playbook failed');
    }
    const playbookId = playbookData.data.id;
    console.log('✅ Playbook Created:', playbookId);

    // 3. Create a Dummy Case (to run playbook on)
    // We need a case ID. Let's list cases and pick one or create one.
    // Let's create one to be safe.
    console.log('3. Creating Case...');
    const caseRes = await fetch(`${BASE_URL}/cases`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Cookie': cookie },
        body: JSON.stringify({
            title: 'Test Case for Approval ' + Date.now(),
            description: 'Test case',
            severity: 'low',
            status: 'open'
        })
    });
    const caseData = await caseRes.json() as any;
    const caseId = caseData.data.id;
    console.log('✅ Case Created:', caseId);

    // 4. Run Playbook
    console.log('4. Running Playbook...');
    const runRes = await fetch(`${BASE_URL}/playbooks/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Cookie': cookie },
        body: JSON.stringify({
            caseId,
            playbookId
        })
    });
    const runData = await runRes.json() as any;
    const executionId = runData.data.id;
    console.log('✅ Playbook Execution Started:', executionId);

    // 5. Execute Step 1 (Manual) - Mark as done (Optional, but let's skip to Step 2)
    // Actually, logic is: user must execute manually.
    // We need to find the step ID for approval.
    // The execution should have created ExecutionSteps.
    // Let's get execution details.
    const execDetailRes = await fetch(`${BASE_URL}/playbooks/executions?caseId=${caseId}`, {
        headers: { 'Cookie': cookie }
    });
    const execList = await execDetailRes.json() as any;
    const headers = { 'Content-Type': 'application/json', 'Cookie': cookie }; // define headers for subsequent requests

    // We assume ours is the latest
    const execution = execList.data[0]; 
    // Find approval step
    const approvalStep = execution.steps.find((s: any) => s.step.type === 'approval');
    if (!approvalStep) throw new Error('Approval step not found in execution');
    
    console.log('Found Approval Step:', approvalStep.id);

    // 6. Execute the Approval Step (This triggers the request)
    // The frontend would call "execute" to start it.
    console.log('5. Triggering Approval Step...');
    const triggerRes = await fetch(`${BASE_URL}/playbooks/executions/${executionId}/steps/${approvalStep.id}/execute`, {
        method: 'POST',
        headers
    });
    const triggerData = await triggerRes.json() as any;
    console.log('Trigger Result:', triggerData); // Should say "waiting_for_approval"

    if (triggerData.data.status !== 'waiting_for_approval') throw new Error('Expected waiting_for_approval status');

    // 7. Check Pending Approvals
    console.log('6. Checking Pending Approvals...');
    const pendingRes = await fetch(`${BASE_URL}/approvals/pending`, { headers });
    const pendingData = await pendingRes.json() as any;
    
    const approvalRequest = pendingData.data.find((a: any) => a.executionId === executionId);
    if (!approvalRequest) throw new Error('Approval request not found in pending list');
    console.log('✅ Found Approval Request:', approvalRequest.id);

    // 8. Approve it
    console.log('7. Approving...');
    const approveRes = await fetch(`${BASE_URL}/approvals/${approvalRequest.id}/decide`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
            decision: 'approved',
            comments: 'LGTM via Automated Verification'
        })
    });
    const approveResult = await approveRes.json() as any;
    console.log('Approve Result:', approveResult);

    if (!approveResult.success) throw new Error('Approval failed');

    console.log('🎉 Verification Successful! Workflow Complete.');
}

main().catch(err => {
    console.error('❌ Verification Failed:', err);
    process.exit(1);
});
