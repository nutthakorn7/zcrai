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

  /**
   * Get current user's profile information
   * @route GET /profile
   * @access Protected - Requires authentication via JWT
   * @returns {Object} User profile with personal information
   */
  .get('/', async ({ jwt, cookie: { access_token }, set }) => {
    const payload = await jwt.verify(access_token.value as string)
    if (!payload) throw new Error('Unauthorized')

    return await ProfileService.get(payload.id as string)
  })

  /**
   * List all active sessions for the current user
   * @route GET /profile/sessions
   * @access Protected - Requires authentication
   * @returns {Object} List of active login sessions with device info
   */
  .get('/sessions', async ({ jwt, cookie: { access_token }, set }) => {
    const payload = await jwt.verify(access_token.value as string)
    if (!payload) throw new Error('Unauthorized')

   return await SessionService.listActive(payload.id as string)
  })

  /**
   * Revoke/logout a specific session
   * @route DELETE /profile/sessions/:id
   * @access Protected - Requires authentication
   * @param {string} id - Session ID to revoke
   * @returns {Object} Success message
   */
  .delete('/sessions/:id', async ({ params, jwt, cookie: { access_token }, set }) => {
    const payload = await jwt.verify(access_token.value as string)
    if (!payload) throw new Error('Unauthorized')

    return await SessionService.revoke(params.id, payload.id as string)
  })

  /**
   * Update user profile information
   * @route PUT /profile
   * @access Protected - Requires authentication
   * @body {string} name - Display name (optional)
   * @body {string} email - Email address (optional)
   * @returns {Object} Updated profile data
   */
  .put('/', async ({ body, jwt, cookie: { access_token }, set }) => {
    const payload = await jwt.verify(access_token.value as string)
    if (!payload) throw new Error('Unauthorized')

    const profile = await ProfileService.update(payload.id as string, body)
    return { message: 'Profile updated successfully', profile }
  }, { body: UpdateProfileSchema })

  /**
   * Change user password
   * @route PUT /profile/password
   * @access Protected - Requires authentication
   * @body {string} currentPassword - Current password for verification
   * @body {string} newPassword - New password
   * @returns {Object} Success message
   * @throws {401} Invalid current password
   */
  .put('/password', async ({ body, jwt, cookie: { access_token }, set }) => {
    const payload = await jwt.verify(access_token.value as string)
    if (!payload) throw new Error('Unauthorized')

    await AuthService.changePassword(payload.id as string, body.currentPassword, body.newPassword)
    return { message: 'Password changed successfully' }
  }, { body: ChangePasswordSchema })

  /**
   * Enable Multi-Factor Authentication (MFA) for user account
   * @route POST /profile/mfa/enable
   * @access Protected - Requires authentication
   * @returns {Object} QR code and secret for authenticator app setup
   */
  .post('/mfa/enable', async ({ jwt, cookie: { access_token }, set }) => {
    const payload = await jwt.verify(access_token.value as string)
    if (!payload) throw new Error('Unauthorized')

    const result = await MFAService.enable(payload.id as string)
    return { message: 'MFA enabled. Scan QR code', ...result }
  })

  /**
   * Verify and confirm MFA setup
   * @route POST /profile/mfa/verify
   * @access Protected - Requires authentication
   * @body {string} code - 6-digit code from authenticator app
   * @returns {Object} Success confirmation
   * @throws {400} Invalid MFA code
   */
  .post('/mfa/verify', async ({ body, jwt, cookie: { access_token }, set }) => {
    const payload = await jwt.verify(access_token.value as string)
    if (!payload) throw new Error('Unauthorized')

    await MFAService.verifySetup(payload.id as string, body.code)
    return { message: 'MFA verified successfully' }
  }, { body: MFAVerifySchema })

  /**
   * Disable Multi-Factor Authentication
   * @route POST /profile/mfa/disable
   * @access Protected - Requires authentication + current password
   * @body {string} password - Current password for security verification
   * @returns {Object} Success message
   * @throws {401} Invalid password
   */
  .post('/mfa/disable', async ({ body, jwt, cookie: { access_token }, set }) => {
    const payload = await jwt.verify(access_token.value as string)
    if (!payload) throw new Error('Unauthorized')

    await MFAService.disable(payload.id as string, body.password)
    return { message: 'MFA disabled successfully' }
  }, { body: MFADisableSchema })
