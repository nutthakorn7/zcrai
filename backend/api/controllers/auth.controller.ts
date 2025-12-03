import { Elysia } from 'elysia'
import { jwt } from '@elysiajs/jwt'
import { AuthService } from '../core/services/auth.service'
import { MFAService } from '../core/services/mfa.service'
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
      exp: '1h' // Session expires after 1 hour of inactivity
    })
  )

  // ==================== REGISTER ====================
  .post('/register', async ({ body, set }) => {
    try {
      const result = await AuthService.register(body)
      set.status = 201
      return { message: 'User registered successfully', user: result.user }
    } catch (e: any) {
      set.status = 400
      return { error: e.message }
    }
  }, { body: RegisterSchema })

  // ==================== LOGIN ====================
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
      const refreshTokenValue = await AuthService.createRefreshToken(user.id, userAgent)

      access_token.set({
        value: accessToken,
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60, // 1 hour
        path: '/'
      })

      refresh_token.set({
        value: refreshTokenValue,
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60,
        path: '/auth/refresh'
      })

      return { 
        message: 'Login successful', 
        user: { id: user.id, email: user.email, role: user.role, tenantId: user.tenantId }
      }
    } catch (e: any) {
      set.status = 401
      return { error: e.message }
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
  .get('/me', async ({ jwt, cookie: { access_token }, set }) => {
    try {
      if (!access_token.value || typeof access_token.value !== 'string') {
        throw new Error('Unauthorized')
      }
      
      const payload = await jwt.verify(access_token.value)
      if (!payload) throw new Error('Invalid token')

      const user = await AuthService.getUserById(payload.id as string)
      if (!user) throw new Error('User not found')

      return {
        id: user.id,
        email: user.email,
        role: user.role,
        tenantId: user.tenantId
      }
    } catch (e: any) {
      set.status = 401
      return { error: e.message }
    }
  })

  // ==================== REFRESH TOKEN ====================
  .post('/refresh', async ({ jwt, cookie: { access_token, refresh_token }, set, request }) => {
    try {
      if (!refresh_token.value || typeof refresh_token.value !== 'string') {
        throw new Error('Refresh token required')
      }

      const userAgent = request.headers.get('user-agent') || undefined
      const newRefreshToken = await AuthService.rotateRefreshToken(refresh_token.value, userAgent)
      
      const session = await AuthService.verifyRefreshToken(newRefreshToken)
      const user = await AuthService.getUserById(session.userId)
      if (!user) throw new Error('User not found')

      const accessToken = await jwt.sign({
        id: user.id,
        role: user.role,
        tenantId: user.tenantId
      })

      access_token.set({
        value: accessToken,
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60, // 1 hour
        path: '/'
      })

      refresh_token.set({
        value: newRefreshToken,
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60,
        path: '/auth/refresh'
      })

      return { message: 'Token refreshed' }
    } catch (e: any) {
      set.status = 401
      access_token.remove()
      refresh_token.remove()
      return { error: e.message }
    }
  })

  // ==================== FORGOT PASSWORD ====================
  .post('/forgot-password', async ({ body }) => {
    return await AuthService.createResetToken(body.email)
  }, { body: ForgotPasswordSchema })

  // ==================== RESET PASSWORD ====================
  .post('/reset-password', async ({ body, set }) => {
    try {
      return await AuthService.resetPassword(body.token, body.newPassword)
    } catch (e: any) {
      set.status = 400
      return { error: e.message }
    }
  }, { body: ResetPasswordSchema })

  // ==================== MFA SETUP ====================
  .post('/mfa/setup', async ({ jwt, cookie: { access_token }, set }) => {
    try {
      const payload = await jwt.verify(access_token.value)
      if (!payload) throw new Error('Unauthorized')

      const user = await AuthService.getUserById(payload.id as string)
      if (!user) throw new Error('User not found')

      return await MFAService.setup(user.id, user.email)
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
