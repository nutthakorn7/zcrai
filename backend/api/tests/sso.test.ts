import { describe, expect, it } from 'bun:test'
import { api, AUTH_CREDENTIALS } from './setup'

describe('SSO Controller', () => {
    
    it('should fail sso login without parameters', async () => {
        // Validation error -> 422
        const { response, error } = await api.auth.sso.login.get({ 
            $query: { provider: '', tenantId: '' } 
        } as any);

        expect(response.status).toBe(422)
    })

    it('should fail callback without state', async () => {
        const { response, data, error } = await api.auth.sso.callback.get({
            $query: { code: 'fake_code' }
        } as any);

        expect(response.status).toBe(400)
        if (error) {
             expect(error.value).toBeTruthy()
        } else {
             expect(data?.error).toBeTruthy()
        }
    })

        const { response: loginResp } = await api.auth.login.post({
            email: AUTH_CREDENTIALS.email,
            password: AUTH_CREDENTIALS.password
        });
        expect(loginResp.status).toBe(200);
        const cookie = loginResp.headers.get('set-cookie');
        expect(cookie).toBeTruthy();

        // 2. Save Config
        const CONFIG = {
            clientId: 'test-client-id',
            clientSecret: 'test-secret',
            issuer: 'https://accounts.google.com',
            provider: 'google',
            isEnabled: true
        };

        const { response: saveResp, data: saveData, error: saveError } = await api.auth.sso.config.put(CONFIG, {
            headers: { cookie: cookie! }
        });
        
        expect(saveResp.status).toBe(200);

        // 3. Get Config
        const { response: getResp, data: getData } = await api.auth.sso.config.get({
            headers: { cookie: cookie! }
        });
        
        expect(getResp.status).toBe(200);
        expect(getData?.clientId).toBe(CONFIG.clientId);
        expect(getData?.issuer).toBe(CONFIG.issuer);
        // clientSecret might be included as per my implementation
        expect(getData?.clientSecret).toBe(CONFIG.clientSecret);
    });
})
