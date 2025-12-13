import { describe, expect, it, beforeAll, afterAll } from 'bun:test'
import { api, getAuthHeaders } from './setup'
import { analyticsService } from '../core/services/analytics.service'

// Mock Data
const mockMetrics = {
    period: { start: new Date('2023-01-01'), end: new Date('2023-01-31') },
    totals: { cases: 10, resolved: 5, mttrHours: 2.5 },
    distribution: { status: [], severity: [], type: [] },
    trends: { volume: [] }
}

// Save originals
const originalGetDashboardMetrics = analyticsService.getDashboardMetrics

// Apply Mocks
analyticsService.getDashboardMetrics = async () => mockMetrics

describe('Analytics Controller', () => {
    let headers: { cookie: string }

    beforeAll(async () => {
        headers = await getAuthHeaders()
        headers.cookie += '; selected_tenant=test-tenant-id'
    })

    afterAll(() => {
        analyticsService.getDashboardMetrics = originalGetDashboardMetrics
    })

    it('should get dashboard metrics', async () => {
        const { data, response } = await api.api.analytics.dashboard.get({ headers })
        expect(response.status).toBe(200)
        expect(data?.success).toBe(true)
        // @ts-ignore
        expect(data?.data).toEqual(mockMetrics)
    })
})
