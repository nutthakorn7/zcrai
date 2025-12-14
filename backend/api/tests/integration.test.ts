import { describe, expect, it, beforeAll } from 'bun:test'
import { api, AUTH_CREDENTIALS } from './setup'

describe('Integration Controller', () => {
    let authCookie: string

    beforeAll(async () => {
        const { response } = await api.auth.login.post({
            email: AUTH_CREDENTIALS.email,
            password: AUTH_CREDENTIALS.password
        })
        const cookie = response.headers.get('set-cookie')
        if (!cookie) throw new Error('Failed to login: No cookie')
        authCookie = cookie
    })

    it('should add AWS integration', async () => {
        const { data, error, response } = await api.integrations.aws.post({
            accessKeyId: 'AKIA_TEST_KEY',
            secretAccessKey: 'test_secret_key',
            region: 'us-east-1',
            bucketName: 'mock-cloudtrail-logs',
            label: 'Test AWS Integration'
        }, {
            headers: { cookie: authCookie }
        })

        if (error) console.error('Add AWS Error:', error.value)

        expect(error).toBeNull()
        expect(response.status).toBe(201)
        expect(data).toBeDefined()
        expect(data?.integration?.provider).toBe('aws-cloudtrail')
        expect(data?.integration?.keyId).toBe('AKIA_TEST_KEY')
    })

    it('should trigger AWS sync', async () => {
        const { data, error, response } = await api.integrations.aws.sync.post({}, {
            headers: { cookie: authCookie }
        })

        if (error) console.error('Sync AWS Error:', error.value)

        expect(error).toBeNull()
        expect(response.status).toBe(200)
        expect(data?.message).toBe('AWS CloudTrail Sync Complete')
        expect(data?.result?.processed).toBeNumber()
    })
})
