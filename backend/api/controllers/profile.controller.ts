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
    const payload = await jwt.verify(access_token.value as string)
    if (!payload) throw new Error('Unauthorized')

    return await ProfileService.get(payload.id as string)
  })

  // ==================== GET ACTIVE SESSIONS ====================
  .get('/sessions', async ({ jwt, cookie: { access_token }, set }) => {
    const payload = await jwt.verify(access_token.value as string)
    if (!payload) throw new Error('Unauthorized')

   return await SessionService.listActive(payload.id as string)
  })

  // ==================== REVOKE SESSION ====================
  .delete('/sessions/:id', async ({ params, jwt, cookie: { access_token }, set }) => {
    const payload = await jwt.verify(access_token.value as string)
    if (!payload) throw new Error('Unauthorized')

    return await SessionService.revoke(params.id, payload.id as string)
  })

  // ==================== UPDATE PROFILE ====================
  .put('/', async ({ body, jwt, cookie: { access_token }, set }) => {
    const payload = await jwt.verify(access_token.value as string)
    if (!payload) throw new Error('Unauthorized')

    const profile = await ProfileService.update(payload.id as string, body)
    return { message: 'Profile updated successfully', profile }
  }, { body: UpdateProfileSchema })

  // ==================== CHANGE PASSWORD ====================
  .put('/password', async ({ body, jwt, cookie: { access_token }, set }) => {
    const payload = await jwt.verify(access_token.value as string)
    if (!payload) throw new Error('Unauthorized')

    return await ProfileService.changePassword(
      payload.id as string,
      body.currentPassword,
      body.newPassword
    )
  }, { body: ChangePasswordSchema })

  // ==================== MFA SETUP ====================
  .post('/mfa/setup', async ({ jwt, cookie: { access_token }, set }) => {
    const payload = await jwt.verify(access_token.value as string)
    if (!payload) throw new Error('Unauthorized')

    const profile = await ProfileService.get(payload.id as string)
    return await MFAService.setup(payload.id as string, profile.email)
  })

  // ==================== MFA VERIFY ====================
  .post('/mfa/verify', async ({ body, jwt, cookie: { access_token }, set }) => {
    const payload = await jwt.verify(access_token.value as string)
    if (!payload) throw new Error('Unauthorized')

    return await MFAService.verifyAndEnable(
      payload.id as string,
      body.secret,
      body.code,
      body.backupCodes
    )
  }, { body: MFAVerifySchema })

  // ==================== MFA DISABLE ====================
  .post('/mfa/disable', async ({ body, jwt, cookie: { access_token }, set }) => {
    const payload = await jwt.verify(access_token.value as string)
    if (!payload) throw new Error('Unauthorized')

    return await MFAService.disable(payload.id as string, body.password)
  }, { body: MFADisableSchema })
