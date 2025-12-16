import { Elysia } from 'elysia'
import { jwt } from '@elysiajs/jwt'
import { AuthService } from '../core/services/auth.service'
import { MFAService } from '../core/services/mfa.service'
import { analyticsService } from '../core/services/analytics.service'
import { setAccessTokenCookie, setRefreshTokenCookie, clearAuthCookies } from '../config/cookies'
import { Errors } from '../middleware/error'
import { 
  LoginSchema, 
  RegisterSchema, 
  ForgotPasswordSchema, 
  ResetPasswordSchema,
  MFAVerifySchema,
  MFADisableSchema 
} from '../validators/auth.validator'

export const authController = new Elysia({ prefix: '/auth' })
  .use(
    jwt({
      name: 'jwt',
      secret: process.env.JWT_SECRET || 'super_secret_dev_key',
      exp: process.env.JWT_ACCESS_EXPIRY || '7d'
    })
  )

  /**
   * Register a new user account
   * @route POST /auth/register
   * @access Public
   * @body {string} email - User email address
   * @body {string} password - Account password
   * @body {string} name - Display name
   * @returns {Object} Created user details
   * @throws {400} Email already exists
   */
  .post('/register', async ({ body, set }) => {
    const result = await AuthService.register(body)
    set.status = 201
    return { message: 'User registered successfully', user: result.user }
  }, { body: RegisterSchema })

  /**
   * Login with email and password (with optional MFA)
   * @route POST /auth/login
   * @access Public
   * @body {string} email - User email
   * @body {string} password - User password
   * @body {string} mfaCode - MFA code (if MFA enabled)
   * @returns {Object} User details with access/refresh tokens in cookies
   * @throws {401} Invalid credentials
   * @throws {400} MFA code required/invalid
   */
  .post('/login', async ({ body, jwt, cookie: { access_token, refresh_token }, set, request }) => {
    try {
      const user = await AuthService.login(body)
      
      if (user.mfaEnabled) {
        if (!body.mfaCode) {
          return { requireMFA: true, message: 'MFA code required' }
        }
        await MFAService.verifyCode(user.id, body.mfaCode)
      }

      const accessToken = await jwt.sign({
        id: user.id,
        role: user.role,
        tenantId: user.tenantId
      })

      const userAgent = request.headers.get('user-agent') || undefined
      const ipAddress = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 
                        request.headers.get('x-real-ip') || 
                        'unknown'

      const refreshToken = await jwt.sign({
        id: user.id,
        type: 'refresh'
      })

      setAccessTokenCookie(access_token, accessToken)
      setRefreshTokenCookie(refresh_token, refreshToken)

      await analyticsService.trackLogin(user.id, user.tenantId || '', ipAddress, userAgent, true)

      return {
        success: true,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          tenantId: user.tenantId,
          mfaEnabled: user.mfaEnabled
        }
      }
    } catch (error: any) {
      if (error.message === 'Invalid credentials' || error.message?.includes('Invalid credentials')) {
        set.status = 401
        return { success: false, message: 'Invalid credentials' }
      }
      if (error.message?.includes('Account locked')) {
        set.status = 429
        return { success: false, message: error.message }
      }
      throw error
    }
  }, { body: LoginSchema })

  /**
   * Get current user profile
   * @route GET /auth/me
   * @access Protected
   * @returns {Object} Current user details
   */
  .get('/me', async ({ jwt, cookie: { access_token }, set }) => {
    try {
      if (!access_token.value) {
        set.status = 401
        return { success: false, message: 'Not authenticated' }
      }

      const payload = await jwt.verify(access_token.value as string)
      if (!payload) {
        set.status = 401
        return { success: false, message: 'Invalid token' }
      }

      const user = await AuthService.getUserById(payload.id as string)
      if (!user) {
        set.status = 404
        return { success: false, message: 'User not found' }
      }

      return {
        success: true,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          tenantId: user.tenantId,
          mfaEnabled: user.mfaEnabled
        }
      }
    } catch (e) {
      set.status = 401
      return { success: false, message: 'Authentication failed' }
    }
  })

  /**
   * Logout current session
   * @route POST /auth/logout
   * @access Public
   * @returns {Object} Success message
   * @description Clears authentication cookies
   */
  .post('/logout', async ({ cookie: { access_token, refresh_token } }) => {
    clearAuthCookies(access_token, refresh_token)
    return { success: true, message: 'Logged out successfully' }
  })

  /**
   * Refresh access token using refresh token
   * @route POST /auth/refresh
   * @access Public (requires refresh token cookie)
   * @returns {Object} New access token in cookie
   * @throws {401} Invalid/expired refresh token
   */
  .post('/refresh', async ({ jwt, cookie: { access_token, refresh_token } }) => {
    const payload = await jwt.verify(refresh_token.value as string)
    if (!payload || payload.type !== 'refresh') {
      throw Errors.Unauthorized('Invalid refresh token')
    }

    const user = await AuthService.getUserById(payload.id as string)
    if (!user) {
      throw Errors.Unauthorized('User not found')
    }

    const newAccessToken = await jwt.sign({
      id: user.id,
      role: user.role,
      tenantId: user.tenantId
    })

    setAccessTokenCookie(access_token, newAccessToken)

    return { success: true, message: 'Token refreshed' }
  })

  /**
   * Request password reset email
   * @route POST /auth/forgot-password
   * @access Public
   * @body {string} email - User email address
   * @returns {Object} Success message (always returns success for security)
   */
  .post('/forgot-password', async ({ body }) => {
    await AuthService.requestPasswordReset(body.email)
    return { success: true, message: 'If email exists, reset link will be sent' }
  }, { body: ForgotPasswordSchema })

  /**
   * Reset password with token from email
   * @route POST /auth/reset-password
   * @access Public
   * @body {string} token - Reset token from email
   * @body {string} newPassword - New password
   * @returns {Object} Success message
   * @throws {400} Invalid/expired token
   */
  .post('/reset-password', async ({ body }) => {
    await AuthService.resetPassword(body.token, body.newPassword)
    return { success: true, message: 'Password reset successfully' }
  }, { body: ResetPasswordSchema })

  /**
   * Verify MFA code during login
   * @route POST /auth/mfa/verify
   * @access Public (during login flow)
   * @body {string} code - 6-digit MFA code
   * @body {string} userId - User ID from login attempt
   * @returns {Object} Success with tokens if valid
   * @throws {400} Invalid MFA code
   */
  .post('/mfa/verify', async ({ body, jwt, cookie: { access_token, refresh_token } }) => {
    const isValid = await MFAService.verifyCode(body.userId, body.code)
    
    if (!isValid) {
      throw Errors.BadRequest('Invalid MFA code')
    }

    const user = await AuthService.getUserById(body.userId)
    if (!user) {
      throw Errors.Unauthorized('User not found')
    }

    const accessToken = await jwt.sign({
      id: user.id,
      role: user.role,
      tenantId: user.tenantId
    })

    const refreshToken = await jwt.sign({
      id: user.id,
      type: 'refresh'
    })

    setAccessTokenCookie(access_token, accessToken)
    setRefreshTokenCookie(refresh_token, refreshToken)

    return { success: true, user }
  }, { body: MFAVerifySchema })
