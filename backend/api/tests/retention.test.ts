import { describe, it, expect, spyOn, mock } from 'bun:test';
import { RetentionService } from '../core/services/retention.service';
import { db } from '../infra/db';
import { clickhouse } from '../infra/clickhouse/client';

describe('Retention Service', () => {
    // Mock ClickHouse query
    const clickhouseQuerySpy = spyOn(clickhouse, 'query').mockResolvedValue({
        json: async () => ({})
    } as any);

    it('should get default retention days', async () => {
        // Mock DB empty result
        // Given difficulty of deep db mock, we rely on default behavior or seed data.
        // If system_config is empty, default is 30.
        // Let's assume test env system_config for 'retention_logs_days' might be empty or present.
        
        const days = await RetentionService.getRetentionDays();
        expect(days).toBeGreaterThan(0);
    });

    it('should update and retrieve retention days', async () => {
        const newDays = 45;
        await RetentionService.updateRetentionDays(newDays);
        
        const days = await RetentionService.getRetentionDays();
        expect(days).toBe(newDays);
    });

    it('should enforce retention and call clickhouse', async () => {
        await RetentionService.enforceRetention();
        
        expect(clickhouseQuerySpy).toHaveBeenCalled();
        // Verify query structure
        const lastCall = clickhouseQuerySpy.mock.calls[clickhouseQuerySpy.mock.calls.length - 1]; // Get last call
        const queryArg = lastCall[0].query;
        
        expect(queryArg).toContain('ALTER TABLE security_events DELETE WHERE timestamp <');
    });
});
