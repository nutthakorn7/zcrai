import { describe, expect, it, beforeAll, mock } from 'bun:test'

// Mock Data
const mockLogsList = {
    data: [{ id: 'log-1', title: 'Test Log', severity: 'high' }],
    pagination: { page: 1, limit: 50, total: 1, totalPages: 1 }
}
const mockLogDetail = { id: 'log-1', title: 'Test Log', severity: 'high', description: 'Detailed desc' }

// Mock Service BEFORE other imports
mock.module('../core/services/logs.service', () => ({
    LogsService: {
        list: mock(async () => {
             console.log('XXX Mock LogsService.list called')
             return mockLogsList
        }),
        getById: mock(async () => mockLogDetail),
        getFilterOptions: mock(async () => ({
            severities: ['high'], sources: [], eventTypes: [], integrations: [], accounts: [], sites: []
        }))
    }
}))

import { api, getAuthHeaders } from './setup'

describe('Logs Controller', () => {
    let headers: { cookie: string }

    beforeAll(async () => {
        headers = await getAuthHeaders()
        headers.cookie += '; selected_tenant=test-tenant-id'
    })

    it('should list logs with pagination', async () => {
        const { data, response } = await api.logs.index.get({ 
            headers,
            query: { page: 1, limit: 10 }
        })
        expect(response.status).toBe(200)
        expect(data?.success).toBe(true)
        // Check strict equality or subset
        expect(data?.data?.data[0].id).toBe(mockLogsList.data[0].id)
    })

    it('should get log detail', async () => {
        const { data, response } = await api.logs({ id: 'log-1' }).get({ headers })
        expect(response.status).toBe(200)
        expect(data).toEqual(mockLogDetail)
    })
})
