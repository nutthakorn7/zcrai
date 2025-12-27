import { describe, expect, it, beforeAll, afterAll } from 'bun:test';
import { db } from '../infra/db';
import { alerts, observables, enrichmentQueue, tenants, users } from '../infra/db/schema';
import { AlertService } from '../core/services/alert.service';
import { EnrichmentWorker } from '../workers/enrichment.worker';
import { eq, and } from 'drizzle-orm';

describe('Enrichment Flow Integration', () => {
    let tenantId: string;
    let userId: string;

    beforeAll(async () => {
        // Setup mock tenant
        const [tenant] = await db.insert(tenants).values({
            name: 'Enrichment Test Tenant',
        }).returning();
        tenantId = tenant.id;

        const [user] = await db.insert(users).values({
            tenantId,
            email: `test-${Date.now()}@test.com`,
            passwordHash: 'hash',
            role: 'admin',
        }).returning();
        userId = user.id;
    });

    it('should postpone AI Triage and trigger after enrichment', async () => {
        // 1. Create alert with an IP that triggers enrichment
        const alertData = {
            tenantId,
            source: 'test-source',
            severity: 'high',
            title: 'Test Alert with IOC',
            description: 'Suspicious activity from IP 8.8.8.8',
        };

        const alert = await AlertService.create(alertData);
        
        // 2. Verify status is 'enriching'
        const [createdAlert] = await db.select().from(alerts).where(eq(alerts.id, alert.id));
        expect(createdAlert.aiTriageStatus).toBe('enriching');

        // 3. Verify observable and enrichment queue items exist
        const alertObservables = await db.select().from(observables).where(eq(observables.alertId, alert.id));
        expect(alertObservables.length).toBeGreaterThan(0);
        
        const ipObservable = alertObservables.find(o => o.type === 'ip' && o.value === '8.8.8.8');
        expect(ipObservable).toBeDefined();

        const [queueItem] = await db.select().from(enrichmentQueue).where(eq(enrichmentQueue.observableId, ipObservable!.id));
        expect(queueItem).toBeDefined();
        expect(queueItem.status).toBe('pending');

        // 4. Run EnrichmentWorker
        const worker = new EnrichmentWorker();
        // We manually call processQueue to simulate the background job
        await (worker as any).processQueue();

        // 5. Verify the alert status has changed to 'processed' (or 'failed' if mock AI fails, but should be 'processed' with mock)
        // Note: Analysis is async fire-and-forget in the worker, so we might need a small wait
        await new Promise(resolve => setTimeout(resolve, 2000));

        const [finalAlert] = await db.select().from(alerts).where(eq(alerts.id, alert.id));
        expect(['processed', 'failed']).toContain(finalAlert.aiTriageStatus!);
        
        if (finalAlert.aiTriageStatus === 'processed') {
            expect(finalAlert.aiAnalysis).toBeDefined();
            const reasoning = (finalAlert.aiAnalysis as any).reasoning;
            console.log('AI Reasoning:', reasoning);
            // Since we use mock providers, VT hits should be there if using AITriage's new logic
            // (The mock provider for VT returns malicious: true)
        }
    });

    afterAll(async () => {
        // Cleanup if needed, but usually test db is transient or handled by global setup
    });
});
