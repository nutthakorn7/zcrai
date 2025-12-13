import { Elysia } from 'elysia'
import { jwt } from '@elysiajs/jwt'
import { AuthService } from '../core/services/auth.service'
import { ProfileService } from '../core/services/profile.service'
import { MFAService } from '../core/services/mfa.service'
import { SessionService } from '../core/services/session.service'
import { UpdateProfileSchema, ChangePasswordSchema } from '../validators/profile.validator'
import { MFAVerifySchema, MFADisableSchema } from '../validators/auth.validator'

export const profileController = new Elysia({ prefix: '/profile' })
  .use(jwt({
    name: 'jwt',
    secret: process.env.JWT_SECRET || 'super_secret_dev_key',
  }))

  // ==================== GET PROFILE ====================
  .get('/', async ({ jwt, cookie: { access_token }, set }) => {
    try {
      const payload = await jwt.verify(access_token.value)
      if (!payload) throw new Error('Unauthorized')

      return await ProfileService.get(payload.id as string)
    } catch (e: any) {
      set.status = 401
      return { error: e.message }
    }
  })

  // ==================== GET ACTIVE SESSIONS ====================
  .get('/sessions', async ({ jwt, cookie: { access_token }, set }) => {
    try {
      const payload = await jwt.verify(access_token.value)
      if (!payload) throw new Error('Unauthorized')

      // We need to mark which session is "current". 
      // Ideally JWT payload has 'jti' or we compare token signature, but here we just list them.
      // Frontend can determine "current" if we return the token ID or similar? 
      // Actually standard JWT doesn't have session ID unless we put it there.
      // For now, let's just return the list. Frontend won't know exactly which is "this" one unless we match IP/UA or add sessionID to JWT.
      // Let's assume we don't know "current" surely yet, but we will return the list.
      return await SessionService.listActive(payload.id as string)
    } catch (e: any) {
      set.status = 401
      return { error: e.message }
    }
  })

  // ==================== REVOKE SESSION ====================
  .delete('/sessions/:id', async ({ params, jwt, cookie: { access_token }, set }) => {
    try {
      const payload = await jwt.verify(access_token.value)
      if (!payload) throw new Error('Unauthorized')

      return await SessionService.revoke(params.id, payload.id as string)
    } catch (e: any) {
      set.status = 400
      return { error: e.message }
    }
  })

  // ==================== UPDATE PROFILE ====================
  .put('/', async ({ body, jwt, cookie: { access_token }, set }) => {
    try {
      const payload = await jwt.verify(access_token.value)
      if (!payload) throw new Error('Unauthorized')

      const profile = await ProfileService.update(payload.id as string, body)
      return { message: 'Profile updated successfully', profile }
    } catch (e: any) {
      set.status = 400
      return { error: e.message }
    }
  }, { body: UpdateProfileSchema })

  // ==================== CHANGE PASSWORD ====================
  .put('/password', async ({ body, jwt, cookie: { access_token }, set }) => {
    try {
      const payload = await jwt.verify(access_token.value)
      if (!payload) throw new Error('Unauthorized')

      return await ProfileService.changePassword(
        payload.id as string,
        body.currentPassword,
        body.newPassword
      )
    } catch (e: any) {
      set.status = 400
      return { error: e.message }
    }
  }, { body: ChangePasswordSchema })

  // ==================== MFA SETUP ====================
  .post('/mfa/setup', async ({ jwt, cookie: { access_token }, set }) => {
    try {
      const payload = await jwt.verify(access_token.value)
      if (!payload) throw new Error('Unauthorized')

      const profile = await ProfileService.get(payload.id as string)
      return await MFAService.setup(payload.id as string, profile.email)
    } catch (e: any) {
      set.status = 401
      return { error: e.message }
    }
  })

  // ==================== MFA VERIFY ====================
  .post('/mfa/verify', async ({ body, jwt, cookie: { access_token }, set }) => {
    try {
      const payload = await jwt.verify(access_token.value)
      if (!payload) throw new Error('Unauthorized')

      return await MFAService.verifyAndEnable(
        payload.id as string,
        body.secret,
        body.code,
        body.backupCodes
      )
    } catch (e: any) {
      set.status = 400
      return { error: e.message }
    }
  }, { body: MFAVerifySchema })

  // ==================== MFA DISABLE ====================
  .post('/mfa/disable', async ({ body, jwt, cookie: { access_token }, set }) => {
    try {
      const payload = await jwt.verify(access_token.value)
      if (!payload) throw new Error('Unauthorized')

      return await MFAService.disable(payload.id as string, body.password)
    } catch (e: any) {
      set.status = 400
      return { error: e.message }
    }
  }, { body: MFADisableSchema })
