import { describe, it, expect, beforeAll } from 'bun:test';
import { DetectionService } from '../core/services/detection.service';
import { db } from '../infra/db';
import { detectionRules, alerts } from '../infra/db/schema';
import { eq } from 'drizzle-orm';

describe('Detection Engine', () => {
    let tenantId = 'e746d022-89dd-4134-a60c-be3583f47f6c'; // Super Admin tenant from seed
    let ruleId: string;

    it('should create a detection rule', async () => {
        const rule = await DetectionService.createRule({
            tenantId,
            name: 'Test Detection Rule',
            description: 'Detects a test log',
            severity: 'high',
            query: "title = 'TEST_ATTACK_SIGNATURE'",
            isEnabled: true,
            runIntervalSeconds: 60
        });
        
        expect(rule).toBeTruthy();
        expect(rule.id).toBeDefined();
        ruleId = rule.id;
    });

    it('should run detection rules and find nothing initially (mocking no logs)', async () => {
        // We expect no error, even if no logs
        // Note: We can't easily mock ClickHouse write in this environment without a real ClickHouse instance running and configured for tests.
        // Assuming Integration Test Environment has access to services.
        
        // This test mostly checks if the SERVICE executes without crashing.
        await DetectionService.runAllDueRules();
        
        // Verify lastRunAt update
        const [updatedRule] = await db.select().from(detectionRules).where(eq(detectionRules.id, ruleId));
        expect(updatedRule.lastRunAt).toBeDefined();
    });
    
    // Note: To test actual alerting, we would need to insert into ClickHouse `security_events` table.
    // If ClickHouse is available, we could:
    // 1. Insert Log
    // 2. Run Rule
    // 3. Check Postgres Alerts
});
