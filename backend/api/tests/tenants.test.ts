import { describe, expect, it, beforeAll } from 'bun:test'
import { api, getAuthHeaders } from './setup'

describe('Tenant Controller', () => {
    let headers: { cookie: string }
    let createdTenantId: string

    beforeAll(async () => {
        headers = await getAuthHeaders()
    })

    it('should create a new tenant', async () => {
        const tenantName = `Test Tenant ${Date.now()}`
        const { data, response } = await api.tenants.post({
            name: tenantName
        }, { headers })

        expect(response.status).toBe(201)
        expect(data?.tenant?.name).toBe(tenantName)
        expect(data?.tenant?.status).toBe('active')
        
        if (data?.tenant?.id) {
            createdTenantId = data.tenant.id
        }
    })

    it('should list tenants', async () => {
        const { data, response } = await api.tenants.get({ headers })
        expect(response.status).toBe(200)
        expect(Array.isArray(data?.data)).toBe(true)
        expect(data?.data?.length).toBeGreaterThan(0)
    })

    it('should get tenant details with stats', async () => {
        if (!createdTenantId) throw new Error('No tenant created')

        const { data, response } = await api.tenants({ id: createdTenantId }).get({ headers })
        expect(response.status).toBe(200)
        expect(data?.id).toBe(createdTenantId)
        // Check for userCount as per service implementation
        expect(data?.userCount).toBeDefined()
        expect(typeof data?.userCount).toBe('number')
    })

    it('should update tenant', async () => {
        if (!createdTenantId) throw new Error('No tenant created')

        const newName = `Updated Tenant ${Date.now()}`
        const { data, response } = await api.tenants({ id: createdTenantId }).put({
            name: newName
        }, { headers })

        expect(response.status).toBe(200)
        expect(data?.tenant?.name).toBe(newName)
    })

    // Soft delete test
    it('should suspend (delete) tenant', async () => {
        if (!createdTenantId) throw new Error('No tenant created')

        const { response } = await api.tenants({ id: createdTenantId }).delete(undefined, { headers })
        expect(response.status).toBe(200)

        // Verify status change
        const { data } = await api.tenants({ id: createdTenantId }).get({ headers })
        expect(data?.status).toBe('suspended')
    })
})
