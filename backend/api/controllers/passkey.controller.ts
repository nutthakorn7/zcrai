/**
 * Passkey Controller
 * WebAuthn endpoints for registration and authentication
 */

import { Elysia, t } from 'elysia'
import { jwt } from '@elysiajs/jwt'
import { PasskeyService } from '../services/passkey.service'

export const passkeyController = new Elysia({ prefix: '/passkey' })
  .use(jwt({
    name: 'jwt',
    secret: process.env.JWT_SECRET || 'your-256-bit-secret-key-here-minimum-32-chars!'
  }))
  /**
   * Generate registration options (requires auth)
   * POST /auth/passkey/register-options
   */
  .post('/register-options', async ({ body, jwt, cookie: { access_token } }) => {
    // Verify JWT manually for this endpoint
    const token = access_token.value as string
    if (!token) {
      throw new Error('Unauthorized')
    }
    
    const payload = await jwt.verify(token) as { id: string } | null
    if (!payload?.id) {
      throw new Error('Unauthorized')
    }

    const options = await PasskeyService.generateRegistrationOptions(
      payload.id,
      body.email
    )

    return options
  }, {
    body: t.Object({
      email: t.String()
    })
  })

  /**
   * Verify registration and store passkey (requires auth)
   * POST /auth/passkey/register-verify
   */
  .post('/register-verify', async ({ body, jwt, cookie: { access_token } }) => {
    const token = access_token.value as string
    if (!token) {
      throw new Error('Unauthorized')
    }
    
    const payload = await jwt.verify(token) as { id: string } | null
    if (!payload?.id) {
      throw new Error('Unauthorized')
    }

    const result = await PasskeyService.verifyRegistration(
      payload.id,
      body.credential,
      body.name
    )

    return result
  }, {
    body: t.Object({
      credential: t.Any(),
      name: t.Optional(t.String())
    })
  })

  /**
   * Generate authentication options (public)
   * POST /auth/passkey/login-options
   */
  .post('/login-options', async ({ body }) => {
    const options = await PasskeyService.generateAuthenticationOptions(body.email)
    return options
  }, {
    body: t.Object({
      email: t.Optional(t.String())
    })
  })

  /**
   * Verify authentication and login (public)
   * POST /auth/passkey/login-verify
   */
  .post('/login-verify', async ({ body, jwt, cookie: { access_token, refresh_token }, set }) => {
    try {
      const user = await PasskeyService.verifyAuthentication(
        body.credential,
        body.email
      )

      // Generate tokens
      const accessToken = await jwt.sign({
        id: user.id,
        role: user.role,
        tenantId: user.tenantId
      })

      const refreshToken = await jwt.sign({
        id: user.id,
        type: 'refresh'
      })

      // Set cookies
      access_token.set({
        value: accessToken,
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in milliseconds
        path: '/'
      })

      refresh_token.set({
        value: refreshToken,
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000,
        path: '/auth/refresh'
      })

      return {
        success: true,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          tenantId: user.tenantId
        }
      }
    } catch (error: any) {
      set.status = 401
      return { success: false, message: error.message }
    }
  }, {
    body: t.Object({
      credential: t.Any(),
      email: t.Optional(t.String())
    })
  })

  /**
   * Get user's passkeys (requires auth)
   * GET /auth/passkey/list
   */
  .get('/list', async ({ jwt, cookie: { access_token } }) => {
    const token = access_token.value as string
    if (!token) {
      throw new Error('Unauthorized')
    }
    
    const payload = await jwt.verify(token) as { id: string } | null
    if (!payload?.id) {
      throw new Error('Unauthorized')
    }

    const passkeys = await PasskeyService.getUserPasskeys(payload.id)
    return { passkeys }
  })

  /**
   * Delete a passkey (requires auth)
   * DELETE /auth/passkey/:id
   */
  .delete('/:id', async ({ params, jwt, cookie: { access_token }, set }) => {
    const token = access_token.value as string
    if (!token) {
      set.status = 401
      return { success: false, message: 'Unauthorized' }
    }
    
    const payload = await jwt.verify(token) as { id: string } | null
    if (!payload?.id) {
      set.status = 401
      return { success: false, message: 'Unauthorized' }
    }

    try {
      await PasskeyService.deletePasskey(payload.id, params.id)
      return { success: true }
    } catch (error: any) {
      set.status = 400
      return { success: false, message: error.message }
    }
  })
