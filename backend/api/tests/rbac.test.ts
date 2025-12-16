import { describe, expect, it, beforeAll } from 'bun:test'
import { api, getAuthHeaders } from './setup'

describe('RBAC Middleware', () => {
    let adminHeaders: { cookie: string } | null = null
    let userHeaders: { cookie: string } | null = null

    beforeAll(async () => {
        // 1. Get Super Admin Headers
        adminHeaders = await getAuthHeaders()

        // 2. Register a regular user
        const email = `rbac_test_${Date.now()}@test.com`
        const password = 'TestUser@123!'
        
        await api.auth.register.post({
            email,
            password,
            tenantName: 'RBAC Test Tenant'
        })
        
        // Login as the new user
        const { response } = await api.auth.login.post({
            email,
            password
        })
        
        let cookies = response.headers.get('set-cookie');
        if ('getSetCookie' in response.headers && typeof response.headers.getSetCookie === 'function') {
             const c = (response.headers as any).getSetCookie();
             if (Array.isArray(c)) cookies = c.join('; ');
        }
        
        console.log('RBAC User Cookies:', cookies)
        userHeaders = { cookie: cookies || '' }
    })

    it('Super Admin should access Protected Admin Route', async () => {
        if (!adminHeaders) throw new Error('No admin headers')
        
        const { response } = await api.admin.tenants.get({
            headers: adminHeaders
        })
        
        expect(response.status).toBe(200)
    })

    it('Regular User should NOT access Protected Admin Route', async () => {
        if (!userHeaders) throw new Error('No user headers')
        
        const { response } = await api.admin.tenants.get({
            headers: userHeaders
        })
        
        expect(response.status).toBe(403) // Forbidden
    })
})
