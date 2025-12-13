import { describe, expect, it, beforeAll, afterAll } from 'bun:test'
import { api, getAuthHeaders } from './setup'
import { DashboardService } from '../core/services/dashboard.service'

// Mock Data
const mockSummary = { critical: 5, high: 10, medium: 15, low: 20, info: 25, total: 75 }
const mockTimeline = [{ time: new Date('2023-01-01'), source: 'test', count: '10', critical: '1', high: '2', medium: '3', low: '4' }]
const mockTopHosts = [{ host_name: 'server-1', count: '100', critical: '5', high: '10' }]

// Save originals
const originalGetSummary = DashboardService.getSummary
const originalGetTimeline = DashboardService.getTimeline
const originalGetTopHosts = DashboardService.getTopHosts

// Apply Mocks
DashboardService.getSummary = async () => mockSummary
DashboardService.getTimeline = async () => mockTimeline
DashboardService.getTopHosts = async () => mockTopHosts

describe('Dashboard Controller', () => {
    let headers: { cookie: string }

    beforeAll(async () => {
        headers = await getAuthHeaders()
        // Mock tenant selection for superadmin
        headers.cookie += '; selected_tenant=test-tenant-id'
    })

    afterAll(() => {
        // Restore mocks
        DashboardService.getSummary = originalGetSummary
        DashboardService.getTimeline = originalGetTimeline
        DashboardService.getTopHosts = originalGetTopHosts
    })

    it('should get summary', async () => {
        const { data, response } = await api.dashboard.summary.get({ headers })
        expect(response.status).toBe(200)
        expect(data).toEqual(mockSummary)
    })

    it('should get timeline', async () => {
        const { data, response } = await api.dashboard.timeline.get({ headers })
        expect(response.status).toBe(200)
        expect(data).toEqual(mockTimeline)
    })

    it('should get top hosts', async () => {
        const { data, response } = await api.dashboard['top-hosts'].get({ headers })
        expect(response.status).toBe(200)
        expect(data).toEqual(mockTopHosts)
    })
})
