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
        // Elysia/Standard Request returns multiple Set-Cookie headers. 
        // Headers.get('set-cookie') might join them or return first?
        // Let's rely on Treaty's response object if it exposes arrays? No it's standard Response.
        
        let cookies = response.headers.get('set-cookie');
        
        // Try getting all if possible. In Bun, headers.getAll? No.
        // But get('set-cookie') usually returns comma separated.
        // However, cookies use commas for dates! So splitting is hard.
        // If getSetCookie exists:
        if ('getSetCookie' in response.headers && typeof response.headers.getSetCookie === 'function') {
             const c = (response.headers as any).getSetCookie();
             if (Array.isArray(c)) cookies = c.join('; ');
        }

        console.log('Login Cookies Captured:', cookies);

        expect(cookies).toBeTruthy()
        expect(cookies).toContain('access_token')
        expect(cookies).toContain('refresh_token')
        authCookie = cookies
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

    it('should refresh token successfully', async () => {
        if (!authCookie) throw new Error('No auth cookie')
        
        const { response } = await api.auth.refresh.post({}, {
            headers: {
                cookie: authCookie
            }
        })

        if (response.status !== 200) {
             const text = await response.text(); // Read once
             console.log('Refresh Failed Status:', response.status)
             console.log('Refresh Response:', text)
        }
        expect(response.status).toBe(200)
        
        // Update cookie (Refresh rotates token, so we get new refresh_token)
        // We should merge or replace.
        let newCookies = response.headers.get('set-cookie');
        if ('getSetCookie' in response.headers && typeof response.headers.getSetCookie === 'function') {
             const c = (response.headers as any).getSetCookie();
             if (Array.isArray(c)) newCookies = c.join('; ');
        }
        
        expect(newCookies).toBeTruthy()
        authCookie = newCookies 
    })

    it('should logout successfully', async () => {
        if (!authCookie) throw new Error('No auth cookie')

        const { response } = await api.auth.logout.post({}, {
            headers: {
                cookie: authCookie
            }
        })

        expect(response.status).toBe(200)
        
        // Verify we cannot refresh anymore (Revoked)
        // Note: access_token might still be valid (JWT), so 'me' might pass if we send the old cookie.
        // But refreshing should fail.
        const refreshResponse = await api.auth.refresh.post({}, {
             headers: {
                cookie: authCookie
            }
        })
        expect(refreshResponse.response.status).toBe(401)
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
