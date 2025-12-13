import { describe, expect, it, beforeAll } from 'bun:test'
import { api, getAuthHeaders } from './setup'

describe('Case Controller', () => {
    let headers: { cookie: string }
    let createdCaseId: string

    beforeAll(async () => {
        headers = await getAuthHeaders()
    })

    it('should create a new case', async () => {
        const title = `Security Incident ${Date.now()}`
        const { data, response } = await api.cases.index.post({
            title,
            description: 'Suspicious activity detected',
            severity: 'high',
            priority: 'P1'
        }, { headers })

        expect(response.status).toBe(200) // API returns 200 for create based on controller? Controller says nothing explicit, service returns newCase. 
        // Wait, CaseController code:
        // .post('/', ... return CaseService.create ...)
        // Elysia default is 200 via return. Tenant controller explicitly set 201. Case controller didn't.
        
        expect(data?.title).toBe(title)
        expect(data?.severity).toBe('high')
        expect(data?.status).toBe('open')
        
        if (data?.id) {
            createdCaseId = data.id
        }
    })

    it('should list cases', async () => {
        const { data, response } = await api.cases.index.get({ headers })
        expect(response.status).toBe(200)
        expect(Array.isArray(data)).toBe(true)
        expect(data!.length).toBeGreaterThan(0)
    })

    it('should get case detail', async () => {
        if (!createdCaseId) throw new Error('No case created')

        const { data, response } = await api.cases({ id: createdCaseId }).get({ headers })
        expect(response.status).toBe(200)
        expect(data?.id).toBe(createdCaseId)
        expect(Array.isArray(data?.comments)).toBe(true)
        expect(Array.isArray(data?.history)).toBe(true)
    })

    it('should update case', async () => {
        if (!createdCaseId) throw new Error('No case created')

        const { data, response } = await api.cases({ id: createdCaseId }).put({
            status: 'in_progress',
            priority: 'P2'
        }, { headers })

        expect(response.status).toBe(200)
        expect(data?.status).toBe('in_progress')
        expect(data?.priority).toBe('P2')
    })

    it('should add comment', async () => {
        if (!createdCaseId) throw new Error('No case created')

        const commentText = 'Investigating...'
        const { data, response } = await api.cases({ id: createdCaseId }).comments.post({
            content: commentText
        }, { headers })

        expect(response.status).toBe(200)
        expect(data?.content).toBe(commentText)
        
        // Verify comment appears in detail
        const { data: detail } = await api.cases({ id: createdCaseId }).get({ headers })
        expect(detail?.comments.some((c: any) => c.content === commentText)).toBe(true)
    })
})
