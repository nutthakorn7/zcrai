import { describe, expect, it, beforeAll } from 'bun:test'
import { api, getAuthHeaders } from './setup'

describe('Profile Controller', () => {
    let headers: { cookie: string }

    beforeAll(async () => {
        headers = await getAuthHeaders()
    })

    it('should get profile', async () => {
        const { data, response } = await api.profile.get({ headers })
        expect(response.status).toBe(200)
        expect(data?.email).toBe('superadmin@zcr.ai')
        expect(data?.tenant?.name).toBe('System Admin')
    })

    it('should update profile', async () => {
        const { data, response } = await api.profile.put({
            name: 'Updated Name',
            jobTitle: 'Tester',
            bio: 'Automated Bio'
        }, { headers })

        expect(response.status).toBe(200)
        expect(data?.profile?.name).toBe('Updated Name')
        
        // Verify persistence
        const { data: current } = await api.profile.get({ headers })
        expect(current?.name).toBe('Updated Name')
    })

    it('should list active sessions', async () => {
        const { data, response } = await api.profile.sessions.get({ headers })
        expect(response.status).toBe(200)
        expect(Array.isArray(data)).toBe(true)
        expect(data!.length).toBeGreaterThan(0) // Should have current session
    })
})
