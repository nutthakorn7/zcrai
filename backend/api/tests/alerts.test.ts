import { describe, expect, it, beforeAll } from 'bun:test'
import { api, getAuthHeaders } from './setup'

describe('Alert Controller', () => {
    let headers: { cookie: string }
    let createdAlertId: string

    beforeAll(async () => {
        headers = await getAuthHeaders()
    })

    it('should create a new alert', async () => {
        const title = `Suspicious Login ${Date.now()}`
        const { data, response } = await api.alerts.index.post({
            title,
            description: 'Multiple failed login attempts detected',
            severity: 'high',
            source: 'auth-service',
            rawData: { ip: '192.168.1.1' }
        }, { headers })

        expect(response.status).toBe(200) // Controller returns { success: true, data: alert }
        expect(data?.success).toBe(true)
        expect(data?.data?.title).toBe(title)
        expect(data?.data?.status).toBe('new')
        
        if (data?.data?.id) {
            createdAlertId = data.data.id
        }
    })

    it('should list alerts', async () => {
        const { data, response } = await api.alerts.index.get({ headers })
        expect(response.status).toBe(200)
        expect(data?.success).toBe(true)
        expect(Array.isArray(data?.data)).toBe(true)
        expect(data?.data?.length).toBeGreaterThan(0)
    })

    it('should get alert detail', async () => {
        if (!createdAlertId) throw new Error('No alert created')

        const { data, response } = await api.alerts({ id: createdAlertId }).get({ headers })
        expect(response.status).toBe(200)
        expect(data?.success).toBe(true)
        expect(data?.data?.id).toBe(createdAlertId)
    })

    it('should mark alert as reviewing', async () => {
        if (!createdAlertId) throw new Error('No alert created')

        const { data, response } = await api.alerts({ id: createdAlertId }).review.patch(undefined, { headers })

        expect(response.status).toBe(200)
        expect(data?.data?.status).toBe('reviewing')
        // Note: reviewedBy field removed from schema, status change is sufficient
    })

    it('should dismiss alert', async () => {
        if (!createdAlertId) throw new Error('No alert created')

        const { data, response } = await api.alerts({ id: createdAlertId }).dismiss.patch({
            reason: 'False Positive'
        }, { headers })

        expect(response.status).toBe(200)
        expect(data?.data?.status).toBe('dismissed')
    })

    it('should get alert stats', async () => {
        const { data, response } = await api.alerts.stats.summary.get({ headers })
        expect(response.status).toBe(200)
        expect(data?.success).toBe(true)
        expect(data?.data).toBeDefined()
        // Check if stats object has keys
        const stats = data?.data as any
        expect(Number(stats?.total)).toBeGreaterThanOrEqual(1)
        expect(Number(stats?.dismissed)).toBeGreaterThanOrEqual(1)
    })
})
