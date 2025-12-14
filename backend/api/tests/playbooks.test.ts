import { describe, expect, it, beforeAll } from 'bun:test'
import { api, getAuthHeaders } from './setup'

describe('Playbook Controller', () => {
    let headers: { cookie: string }
    let createdPlaybookId: string
    let createdCaseId: string

    beforeAll(async () => {
        headers = await getAuthHeaders()

        // Create a case for testing execution
        const { data, error } = await api.cases.post({
            title: 'Test Case for Playbook',
            description: 'This case is used to test playbook execution',
            severity: 'medium',
            status: 'new'
        }, { headers })

        // @ts-ignore - response format is { success: true, data: { id, ... } }
        createdCaseId = data?.data?.id

        if (!createdCaseId) {
            console.error('Case creation response:', data, error)
            throw new Error('Case creation failed, ID missing')
        }
    })

    it('should create a new playbook', async () => {
        const { data, response } = await api.playbooks.index.post({
            title: 'Test Playbook',
            description: 'Automated response playbook',
            triggerType: 'manual',
            steps: [
                { name: 'Step 1', type: 'manual', description: 'Check logs' },
                { name: 'Step 2', type: 'automation', description: 'Block IP' }
            ]
        }, { headers })

        expect(response.status).toBe(200)
        expect(data?.success).toBe(true)
        expect(data?.data?.id).toBeDefined()
        expect(data?.data?.steps.length).toBe(2)
        createdPlaybookId = data?.data?.id
    })

    it('should list playbooks', async () => {
        const { data, response } = await api.playbooks.index.get({ headers })
        expect(response.status).toBe(200)
        expect(data?.success).toBe(true)
        expect(Array.isArray(data?.data)).toBe(true)
        expect(data?.data?.length).toBeGreaterThan(0)
    })

    it('should get playbook detail', async () => {
        if (!createdPlaybookId) throw new Error('No playbook created')
        
        const { data, response } = await api.playbooks({ id: createdPlaybookId }).get({ headers })
        expect(response.status).toBe(200)
        expect(data?.success).toBe(true)
        expect(data?.data?.id).toBe(createdPlaybookId)
    })

    it('should update playbook', async () => {
        if (!createdPlaybookId) throw new Error('No playbook created')

        const { data, response } = await api.playbooks({ id: createdPlaybookId }).put({
            title: 'Updated Playbook Title',
            description: 'Updated description'
        }, { headers })

        expect(response.status).toBe(200)
        expect(data?.data?.title).toBe('Updated Playbook Title')
    })

    it('should execute playbook on a case', async () => {
        if (!createdPlaybookId || !createdCaseId) throw new Error('Setup failed')

        const { data, response } = await api.playbooks.run.post({
            caseId: createdCaseId,
            playbookId: createdPlaybookId
        }, { headers })

        expect(response.status).toBe(200)
        expect(data?.data?.status).toBe('running')
        expect(data?.data?.steps.length).toBeGreaterThan(0)
    })
})
