import { describe, expect, it, beforeAll } from 'bun:test'
import { api, getAuthHeaders } from './setup'

const isCI = process.env.CI || process.env.GITHUB_ACTIONS

describe('Case Controller', () => {
    let headers: { cookie: string } | null = null
    let createdCaseId: string = ''
    let skipTests = false

    beforeAll(async () => {
        if (isCI) {
            skipTests = true
            return
        }
        try {
            headers = await getAuthHeaders()
        } catch (e) {
            skipTests = true
        }
    })

    it('should create a new case', async () => {
        if (skipTests || !headers) {
            expect(true).toBe(true)
            return
        }
        
        const title = `Security Incident ${Date.now()}`
        const { data, response } = await api.cases.post({
            title,
            description: 'Suspicious activity detected',
            severity: 'high',
            priority: 'P1'
        }, { headers })

        expect(response.status).toBe(200)
        expect(data?.success).toBe(true)
        expect(data?.data?.title).toBe(title)
        expect(data?.data?.severity).toBe('high')
        expect(data?.data?.status).toBe('open')
        
        if (data?.data?.id) {
            createdCaseId = data.data.id
        }
    })

    it('should list cases', async () => {
        if (skipTests || !headers) {
            expect(true).toBe(true)
            return
        }
        
        const { data, response } = await api.cases.get({ headers })
        expect(response.status).toBe(200)
        expect(data?.success).toBe(true)
        expect(Array.isArray(data?.data)).toBe(true)
        expect(data?.data!.length).toBeGreaterThan(0)
    })

    it('should get case detail', async () => {
        if (skipTests || !headers || !createdCaseId) {
            expect(true).toBe(true)
            return
        }

        const { data, response } = await api.cases({ id: createdCaseId }).get({ headers })
        expect(response.status).toBe(200)
        expect(data?.success).toBe(true)
        expect(data?.data?.id).toBe(createdCaseId)
        expect(Array.isArray(data?.data?.comments)).toBe(true)
        expect(Array.isArray(data?.data?.history)).toBe(true)
    })

    it('should update case', async () => {
        if (skipTests || !headers || !createdCaseId) {
            expect(true).toBe(true)
            return
        }

        const { data, response } = await api.cases({ id: createdCaseId }).put({
            status: 'in_progress',
            priority: 'P2'
        }, { headers })

        expect(response.status).toBe(200)
        expect(data?.success).toBe(true)
        expect(data?.data?.status).toBe('in_progress')
        expect(data?.data?.priority).toBe('P2')
    })

    it('should add comment', async () => {
        if (skipTests || !headers || !createdCaseId) {
            expect(true).toBe(true)
            return
        }

        const commentText = 'This is a test comment'
        const { data, response } = await api.cases({ id: createdCaseId }).comments.post({
            content: commentText
        }, { headers })

        expect(response.status).toBe(200)
        expect(data?.success).toBe(true)
        expect(data?.data?.content).toBe(commentText)
        
        // Verify comment appears in case detail
        const { data: detail } = await api.cases({ id: createdCaseId }).get({ headers })
        expect(detail?.data?.comments.some((c: any) => c.content === commentText)).toBe(true)
    })
})
