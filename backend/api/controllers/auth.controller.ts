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
      exp: process.env.JWT_ACCESS_EXPIRY || '7d' // Extended default to 7 days
    })
  )

  // ==================== REGISTER ====================
  .post('/register', async ({ body, set }) => {
    const result = await AuthService.register(body)
    set.status = 201
    return { message: 'User registered successfully', user: result.user }
  }, { body: RegisterSchema })

  // ==================== LOGIN ====================
  .post('/login', async ({ body, jwt, cookie: { access_token, refresh_token }, set, request }) => {
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
    const ip = request.headers.get('x-forwarded-for') || '127.0.0.1'
    const refreshTokenValue = await AuthService.createRefreshToken(user.id, userAgent)
    
    // UEBA: Track Login
    analyticsService.trackLogin(user.id, ip, userAgent || '')

    setAccessTokenCookie(access_token, accessToken)
    setRefreshTokenCookie(refresh_token, refreshTokenValue)

    return { 
      message: 'Login successful', 
      user: { id: user.id, email: user.email, role: user.role, tenantId: user.tenantId }
    }
  }, { body: LoginSchema })

  // ==================== LOGOUT ====================
  .post('/logout', async ({ cookie: { access_token, refresh_token } }) => {
    if (refresh_token.value && typeof refresh_token.value === 'string') {
      await AuthService.revokeRefreshToken(refresh_token.value)
    }
    access_token.remove()
    refresh_token.remove()
    return { message: 'Logged out' }
  })

  // ==================== GET CURRENT USER (ME) ====================
  .get('/me', async ({ jwt, cookie: { access_token } }) => {
    if (!access_token.value || typeof access_token.value !== 'string') {
      throw Errors.Unauthorized()
    }
    
    const payload = (await jwt.verify(access_token.value as string)) as any
    if (!payload) throw Errors.Unauthorized('Invalid token')

    const user = await AuthService.getUserById(payload.id as string)
    if (!user) throw Errors.NotFound('User')

    return {
      id: user.id,
      email: user.email,
      role: user.role,
      tenantId: user.tenantId
      }
  })

  // ==================== REFRESH TOKEN ====================
  .post('/refresh', async ({ jwt, cookie: { access_token, refresh_token }, request }) => {
    if (!refresh_token.value || typeof refresh_token.value !== 'string') {
      clearAuthCookies(access_token, refresh_token)
      throw Errors.Unauthorized('Refresh token required')
    }

    const userAgent = request.headers.get('user-agent') || undefined
    const newRefreshToken = await AuthService.rotateRefreshToken(refresh_token.value, userAgent)
    
    const session = await AuthService.verifyRefreshToken(newRefreshToken)
    const user = await AuthService.getUserById(session.userId)
    if (!user) throw Errors.NotFound('User')

    const accessToken = await jwt.sign({
      id: user.id,
      role: user.role,
      tenantId: user.tenantId
    })

    setAccessTokenCookie(access_token, accessToken)
    setRefreshTokenCookie(refresh_token, newRefreshToken)

    return { message: 'Token refreshed' }
  })

  // ==================== FORGOT PASSWORD ====================
  .post('/forgot-password', async ({ body }) => {
    return await AuthService.createResetToken(body.email)
  }, { body: ForgotPasswordSchema })

  // ==================== RESET PASSWORD ====================
  .post('/reset-password', async ({ body }) => {
    return await AuthService.resetPassword(body.token, body.newPassword)
  }, { body: ResetPasswordSchema })

  // ==================== MFA SETUP ====================
  .post('/mfa/setup', async ({ jwt, cookie: { access_token } }) => {
    const payload = (await jwt.verify(access_token.value as string)) as any
    if (!payload) throw Errors.Unauthorized()

    const user = await AuthService.getUserById((payload as any).id)
    if (!user) throw Errors.NotFound('User')

    return await MFAService.setup(user.id, user.email)
  })

  // ==================== MFA VERIFY ====================
  .post('/mfa/verify', async ({ body, jwt, cookie: { access_token } }) => {
    const payload = (await jwt.verify(access_token.value as string)) as any
    if (!payload) throw Errors.Unauthorized()

    return await MFAService.verifyAndEnable(
      payload.id as string,
      body.secret,
      body.code,
      body.backupCodes
    )
  }, { body: MFAVerifySchema })

  // ==================== MFA DISABLE ====================
  .post('/mfa/disable', async ({ body, jwt, cookie: { access_token } }) => {
    const payload = (await jwt.verify(access_token.value as string)) as any
    if (!payload) throw Errors.Unauthorized()

    return await MFAService.disable(payload.id as string, body.password)
  }, { body: MFADisableSchema })

