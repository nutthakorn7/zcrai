import { Elysia, t } from 'elysia';
import { SSOService } from '../core/services/sso.service';
import { AuthService } from '../core/services/auth.service';

import { jwt } from '@elysiajs/jwt'

export const ssoController = new Elysia({ prefix: '/auth/sso' })
    .use(
        jwt({
            name: 'jwt',
            secret: process.env.JWT_SECRET || 'secret',
        })
    )
    
    // 1. Get Redirect URL for Tenant
    .get('/login/:tenantId', async ({ params: { tenantId }, set }) => {
        try {
            const url = await SSOService.getAuthUrl(tenantId);
            return { url };
        } catch (error: any) {
            set.status = 400;
            return { error: error.message };
        }
    })

    // 2. Callback Handler
    .get('/callback', async ({ query, request, set, cookie: { refresh_token }, jwt }) => {
        try {
            const tenantId = query.tenantId as string;
            if (!tenantId) throw new Error('Missing tenantId in callback');

            const currentUrl = new URL(request.url);
            
            // Exchange code, get user
            const user = await SSOService.handleCallback(tenantId, currentUrl);

            // Generate Access Token (JWT)
            const accessToken = await jwt.sign({
                id: user.id,
                email: user.email,
                role: user.role,
                tenantId: user.tenantId
            });

            // Generate Refresh Token (DB + Redis)
            const refreshToken = await AuthService.createRefreshToken(user.id, request.headers.get('user-agent') || 'unknown');

            // Set Cookies
             refresh_token.set({
                value: refreshToken,
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                path: '/auth/refresh',
                maxAge: 7 * 24 * 60 * 60, // 7 days
            });

            // Redirect to Frontend with Access Token (Fragment)
            const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
            set.redirect = `${frontendUrl}/auth/callback?token=${accessToken}`;
            
        } catch (error: any) {
             set.status = 400;
             return { error: error.message };
        }
    })
    
    // 3. Config Management (Protected)
    .group('/config', app => app
        .get('/', async ({ jwt, cookie: { access_token }, set }) => {
            const token = access_token.value as string;
            if (!token) { set.status = 401; return { error: 'Unauthorized' }; }
            
            const payload = await jwt.verify(token);
            if (!payload) { set.status = 401; return { error: 'Unauthorized' }; }
            
            return await SSOService.getConfig((payload as any).tenantId);
        })
        .put('/', async ({ jwt, cookie: { access_token }, body, set }) => {
            const token = access_token.value as string;
            if (!token) { set.status = 401; return { error: 'Unauthorized' }; }
            
            const payload = await jwt.verify(token);
            if (!payload) { set.status = 401; return { error: 'Unauthorized' }; }
            
            // Enforce admin role check
            const role = (payload as any).role;
            if (role !== 'admin' && role !== 'superadmin') {
                 set.status = 403;
                 return { error: 'Forbidden: Admin access required' };
            }
            
            return await SSOService.saveConfig((payload as any).tenantId, body);
        })
    );
