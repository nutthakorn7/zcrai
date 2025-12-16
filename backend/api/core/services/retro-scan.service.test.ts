import { describe, it, expect, mock, beforeEach } from 'bun:test'
import { RetroScanService } from './retro-scan.service'
import { query } from '../../infra/clickhouse/client'

// Mock ClickHouse client
mock.module('../../infra/clickhouse/client', () => ({
    query: mock(async () => []), 
    // If clickhouse object is used elsewhere, should be mocked too, but service uses `query`.
    clickhouse: {} 
}))

describe('RetroScanService', () => {
    it('should generate correct query for IP', async () => {
        const tenantId = 'tenant-123'
        const type = 'ip'
        const value = '1.1.1.1'
        
        await RetroScanService.scan(tenantId, type, value, 30)
        
        const { query } = await import('../../infra/clickhouse/client')
        const call = (query as any).mock.lastCall[0] // Arguments passed to query(sql, params)
        // Check params
        // query(sql, params) -> args[0] is sql, args[1] is params
        const sql = (query as any).mock.lastCall[0]
        const params = (query as any).mock.lastCall[1]
        
        expect(params.tenantId).toBe(tenantId)
        expect(params.value).toBe(value)
        expect(sql).toContain('host_ip = {value:String}')
    })

    it('should generate correct query for Hash', async () => {
        const tenantId = 'tenant-123'
        const type = 'hash'
        const value = 'a'.repeat(32)
        
        await RetroScanService.scan(tenantId, type, value, 90)

        const { query } = await import('../../infra/clickhouse/client')
        const sql = (query as any).mock.lastCall[0]
        expect(sql).toContain('file_hash = {value:String}')
    })
})

