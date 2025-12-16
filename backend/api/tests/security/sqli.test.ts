import { describe, it, expect, mock } from 'bun:test'
import { RetroScanService } from '../../core/services/retro-scan.service'
import { query } from '../../infra/clickhouse/client'

// Mock ClickHouse client
mock.module('../../infra/clickhouse/client', () => ({
    query: mock(async () => []),
    clickhouse: {}
}))

describe('Security: SQL Injection', () => {
    describe('RetroScanService', () => {
        it('should use parameterized queries for IP scan', async () => {
            const maliciousInput = "' OR 1=1 --"
            await RetroScanService.scan('tenant1', 'ip', maliciousInput, 30)

            const { query } = await import('../../infra/clickhouse/client')
            const call = (query as any).mock.lastCall
            const sql = call[0]
            const params = call[1]
            
            // Verify SQL does not contain raw input
            expect(sql).not.toContain(maliciousInput)
            // Verify input is passed as parameter
            expect(params.value).toBe(maliciousInput)
        })

        it('should use parameterized queries for Hash scan', async () => {
            const maliciousInput = "'; DROP TABLE security_events; --"
            await RetroScanService.scan('tenant1', 'hash', maliciousInput, 30)

            const { query } = await import('../../infra/clickhouse/client')
            const call = (query as any).mock.lastCall
            const sql = call[0]
            const params = call[1]
            
            expect(sql).not.toContain('DROP TABLE')
            expect(params.value).toBe(maliciousInput)
        })
    })
})
