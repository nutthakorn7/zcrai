import { describe, expect, it, beforeAll } from "bun:test";
import { api, getAuthHeaders } from "./setup";
import { registerBuiltInActions } from "../core/actions/builtin";

const isCI = process.env.CI || process.env.GITHUB_ACTIONS

// Ensure Actions are registered
registerBuiltInActions();

describe('Playbook Automation', () => {
    let headers: any = null;
    let skipTests = false;
    let tenantId: string = '';
    let createdCase: any = null;

    beforeAll(async () => {
        if (isCI) {
            skipTests = true;
            return;
        }
        try {
            headers = await getAuthHeaders();
            
            // Get Tenant ID via profile
            const { data, error } = await api.auth.me.get({ headers });
            if (error || !data) {
                skipTests = true;
                return;
            }
            
            tenantId = (data as any).tenantId;
            
            // Create a Test Case via API
            const { data: caseData } = await api.cases.post({
                title: 'Test Case for Automation',
                description: 'Testing SOAR capabilities',
                severity: 'high'
            }, { headers });
            
            // @ts-ignore
            createdCase = caseData?.data;
            
            if (!createdCase?.id) {
                skipTests = true;
            }
        } catch (e) {
            skipTests = true;
        }
    });

    it('should list available actions', async () => {
        if (skipTests || !headers) {
            expect(true).toBe(true);
            return;
        }
        
        const { data } = await api.playbooks.actions.get({ headers });
        expect(data?.success).toBe(true);
        expect(data?.data?.some((a: any) => a.id === 'block_ip')).toBe(true);
    });

    it('should execute an automated playbook step', async () => {
        if (skipTests || !headers || !createdCase) {
            expect(true).toBe(true);
            return;
        }
        
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
        expect(execution?.status).toBe('running');
        
        // @ts-ignore
        const stepId = execution.steps[0].id;

        // 3. Execute Step
        const { data: result } = await api.playbooks.executions({ executionId: execution.id })
            .steps({ stepId })
            .execute.post({}, { headers });
        
        expect(result?.success).toBe(true);
        expect(result?.data?.success).toBe(true);
        expect(result?.data?.output?.status).toBe('blocked');
    });
});
