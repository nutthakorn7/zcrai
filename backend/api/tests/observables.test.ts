import { describe, expect, it, beforeAll } from 'bun:test'
import { api, getAuthHeaders } from './setup'

describe('Observable Controller', () => {
    let headers: { cookie: string }
    let createdObservableId: string

    beforeAll(async () => {
        headers = await getAuthHeaders()
    })

    it('should create a new observable', async () => {
        const { data, response } = await api.observables.index.post({
            type: 'ip',
            value: '1.2.3.4',
            tags: ['test-ip']
        }, { headers })

        expect(response.status).toBe(200)
        expect(data?.success).toBe(true)
        expect(data?.data?.id).toBeDefined()
        expect(data?.data?.value).toBe('1.2.3.4')
        createdObservableId = data?.data?.id
    })

    it('should list observables', async () => {
        const { data, response } = await api.observables.index.get({ headers })
        expect(response.status).toBe(200)
        expect(data?.success).toBe(true)
        expect(Array.isArray(data?.data)).toBe(true)
        expect(data?.data?.length).toBeGreaterThan(0)
    })

    it('should get observable detail', async () => {
        if (!createdObservableId) throw new Error('No observable created')
        
        const { data, response } = await api.observables({ id: createdObservableId }).get({ headers })
        expect(response.status).toBe(200)
        expect(data?.success).toBe(true)
        expect(data?.data?.id).toBe(createdObservableId)
    })

    it('should update malicious status', async () => {
        if (!createdObservableId) throw new Error('No observable created')

        const { data, response } = await api.observables({ id: createdObservableId }).status.patch({
            isMalicious: true
        }, { headers })

        expect(response.status).toBe(200)
        expect(data?.data?.isMalicious).toBe(true)
    })

    it('should add a tag', async () => {
        if (!createdObservableId) throw new Error('No observable created')

        const { data, response } = await api.observables({ id: createdObservableId }).tags.post({
            tag: 'malicious-ip'
        }, { headers })

        expect(response.status).toBe(200)
        // @ts-ignore
        expect(data?.data?.tags).toContain('malicious-ip')
    })
})
