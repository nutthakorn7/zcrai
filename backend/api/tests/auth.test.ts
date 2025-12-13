import { describe, expect, it, beforeAll } from 'bun:test'
import { api, AUTH_CREDENTIALS } from './setup'

describe('Auth Controller', () => {
    let authCookie: string | null = null

    it('should login successfully', async () => {
        const { data, error, response } = await api.auth.login.post({
            email: AUTH_CREDENTIALS.email,
            password: AUTH_CREDENTIALS.password
        })

        if (error) {
            console.error('Login Error:', error.value)
        }

        expect(error).toBeNull()
        expect(response.status).toBe(200)
        expect(data?.user?.email).toBe(AUTH_CREDENTIALS.email)
        
        // Check for cookie
        const cookie = response.headers.get('set-cookie')
        expect(cookie).toBeTruthy()
        expect(cookie).toContain('access_token')
        authCookie = cookie
    })

    it('should get current user profile (Me)', async () => {
        if (!authCookie) throw new Error('No auth cookie')

        const { data, error, response } = await api.auth.me.get({
            headers: {
                cookie: authCookie
            }
        })

        expect(response.status).toBe(200)
        expect(data?.email).toBe(AUTH_CREDENTIALS.email)
    })

    it('should fail login with wrong password', async () => {
        const { error, response } = await api.auth.login.post({
            email: AUTH_CREDENTIALS.email,
            password: 'wrongpassword'
        })

        expect(response.status).toBe(401)
        expect(error).toBeTruthy()
    })
})
