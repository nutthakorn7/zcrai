import { describe, expect, it, beforeAll } from "bun:test";
import { api, getAuthHeaders } from "./setup";
import { db } from "../infra/db";
import { cases } from "../infra/db/schema";
import { registerBuiltInActions } from "../core/actions/builtin";
import { PlaybookService } from "../core/services/playbook.service";

// Ensure Actions are registered
registerBuiltInActions();

describe('Playbook Automation', () => {
    let headers: any;
    let tenantId: string;
    let createdCase: any;

    beforeAll(async () => {
        headers = await getAuthHeaders();
        
        // Get Tenant ID via profile
        const { data, error } = await api.auth.me.get({ headers });
        if (error) console.error('Auth Error:', error.value);
        if (!data) throw new Error("Failed to get profile");
        
        // Assert data is user
        tenantId = (data as any).tenantId;

        // Create a Test Case manually (direct DB to avoid API overhead)
        const [c] = await db.insert(cases).values({
            tenantId,
            title: 'Test Case for Automation',
            description: 'Testing SOAR capabilities',
            severity: 'high'
        }).returning();
        createdCase = c;
    });

    it('should list available actions', async () => {
        const { data } = await api.playbooks.actions.get({ headers });
        expect(data?.success).toBe(true);
        // data.data is the array of actions
        expect(data?.data?.some((a: any) => a.id === 'block_ip')).toBe(true);
    });

    it('should execute an automated playbook step', async () => {
        // 1. Create Playbook with Automation Step
        const playbookData = {
            title: 'Auto Block IP Playbook',
            description: 'Automatically blocks an IP',
            steps: [
                {
                    name: 'Block Malicious IP',
                    type: 'automation',
                    description: 'Blocking 1.2.3.4',
                    actionId: 'block_ip',
                    config: { ip: '1.2.3.4' }
                }
            ]
        };

        const { data: createData } = await api.playbooks.post(playbookData, { headers });
        const playbook = createData?.data;
        expect(playbook?.id).toBeDefined();

        // 2. Run Playbook
        const { data: runData } = await api.playbooks.run.post({
            caseId: createdCase.id,
            playbookId: playbook?.id
        }, { headers });
        
        const execution = runData?.data;
        expect(execution?.id).toBeDefined();
        
        // Check initial status
        expect(execution?.status).toBe('running');
        // @ts-ignore
        const stepId = execution.steps[0].id; // execution step id

        // 3. Execute Step (Manually Trigger Automation via API)
        // api.playbooks.executions({executionId}).steps({stepId}).execute.post()
        const { data: result } = await api.playbooks.executions({ executionId: execution.id })
            .steps({ stepId })
            .execute.post({}, { headers });
        
        expect(result?.success).toBe(true);
        expect(result?.data?.success).toBe(true);
        expect(result?.data?.output?.status).toBe('blocked');
        
        // 4. Verify DB Status
        // @ts-ignore
        const updatedExec = await PlaybookService.getExecution(tenantId, execution.id);
        const updatedStep = updatedExec?.steps.find((s: any) => s.id === stepId);
        expect(updatedStep?.status).toBe('completed');
    });
});
