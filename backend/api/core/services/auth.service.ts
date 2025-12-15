import { db } from '../../infra/db'
import { users, tenants, sessions } from '../../infra/db/schema'
import { eq, and } from 'drizzle-orm'
import { redis, lockoutKey, refreshTokenKey, resetTokenKey } from '../../infra/cache/redis'
import { nanoid } from 'nanoid'
import { EmailService } from './email.service'
import { writeFileSync } from 'fs';

const MAX_LOGIN_ATTEMPTS = 5
const LOCKOUT_DURATION = 15 * 60 // 15 minutes
const REFRESH_TOKEN_EXPIRY = 7 * 24 * 60 * 60 // 7 days
const RESET_TOKEN_EXPIRY = 60 * 60 // 1 hour

export const AuthService = {
  // ==================== REGISTER ====================
  async register(body: { email: string; password: string; tenantName: string }) {
    const existingUser = await db.select().from(users).where(eq(users.email, body.email))
    if (existingUser.length > 0) {
      throw new Error('User already exists')
    }

    const hashedPassword = await Bun.password.hash(body.password)

    return await db.transaction(async (tx) => {
      const [tenant] = await tx.insert(tenants).values({
        name: body.tenantName,
      }).returning()

      const [user] = await tx.insert(users).values({
        email: body.email,
        passwordHash: hashedPassword,
        tenantId: tenant.id,
        role: 'tenant_admin',
      }).returning()

      return { user, tenant }
    })
  },

  // ==================== LOGIN ====================
  async login(body: { email: string; password: string }) {
    try {
      const lockout = await this.checkLockout(body.email)
      if (lockout.locked) {
        throw new Error(`Account locked. Try again in ${lockout.remainingTime} seconds`)
      }

      const [user] = await db.select().from(users).where(eq(users.email, body.email))
      
      if (!user) {
        await this.incrementFailedAttempts(body.email)
        throw new Error('Invalid credentials')
      }

      let isValid = false;
      try {
        isValid = await Bun.password.verify(body.password, user.passwordHash);
      } catch (verifyErr: any) {
        console.error('[AUTH] Verification error:', verifyErr.message);
        throw verifyErr;
      }

      if (!isValid) {
        await this.incrementFailedAttempts(body.email)
         throw new Error('Invalid credentials')
      }

      await this.resetFailedAttempts(body.email)
      return user
    } catch (error: any) {
      // Sanitize database errors - don't leak raw SQL to frontend
      if (error.message?.includes('Invalid credentials') || 
          error.message?.includes('Account locked')) {
        throw error // Re-throw known auth errors
      }
      console.error('Login error:', error.message)
      throw new Error('Authentication failed. Please try again.')
    }
  },

  // ==================== LOCKOUT ====================
  async checkLockout(email: string): Promise<{ locked: boolean; remainingTime: number }> {
    const key = lockoutKey(email)
    const data = await redis.get(key)
    if (!data) return { locked: false, remainingTime: 0 }

    const { attempts, lockedUntil } = JSON.parse(data)
    if (lockedUntil && Date.now() < lockedUntil) {
      return { locked: true, remainingTime: Math.ceil((lockedUntil - Date.now()) / 1000) }
    }
    return { locked: false, remainingTime: 0 }
  },

  async incrementFailedAttempts(email: string) {
    const key = lockoutKey(email)
    const data = await redis.get(key)
    let attempts = 1

    if (data) {
      const parsed = JSON.parse(data)
      attempts = parsed.attempts + 1
    }

    const payload: any = { attempts }
    if (attempts >= MAX_LOGIN_ATTEMPTS) {
      payload.lockedUntil = Date.now() + (LOCKOUT_DURATION * 1000)
    }

    await redis.setex(key, LOCKOUT_DURATION, JSON.stringify(payload))
  },

  async resetFailedAttempts(email: string) {
    await redis.del(lockoutKey(email))
  },

  // ==================== REFRESH TOKEN ====================
  async createRefreshToken(userId: string, userAgent?: string, ipAddress?: string) {
    const token = nanoid(64)
    const expiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRY * 1000)

    await db.insert(sessions).values({
      userId,
      token,
      expiresAt,
      userAgent,
      ipAddress,
      isValid: true,
    })

    await redis.setex(refreshTokenKey(token), REFRESH_TOKEN_EXPIRY, JSON.stringify({ userId }))
    return token
  },

  async verifyRefreshToken(token: string) {
    const cached = await redis.get(refreshTokenKey(token))
    if (!cached) throw new Error('Invalid refresh token')

    const [session] = await db.select().from(sessions)
      .where(and(eq(sessions.token, token), eq(sessions.isValid, true)))

    if (!session || new Date() > session.expiresAt) {
      throw new Error('Refresh token expired')
    }

    return session
  },

  async rotateRefreshToken(oldToken: string, userAgent?: string, ipAddress?: string) {
    const session = await this.verifyRefreshToken(oldToken)

    await db.update(sessions).set({ isValid: false }).where(eq(sessions.token, oldToken))
    await redis.del(refreshTokenKey(oldToken))

    return this.createRefreshToken(session.userId, userAgent, ipAddress)
  },

  async revokeRefreshToken(token: string) {
    await db.update(sessions).set({ isValid: false }).where(eq(sessions.token, token))
    await redis.del(refreshTokenKey(token))
  },

  async revokeAllUserSessions(userId: string) {
    const userSessions = await db.select().from(sessions)
      .where(and(eq(sessions.userId, userId), eq(sessions.isValid, true)))

    for (const session of userSessions) {
      await redis.del(refreshTokenKey(session.token))
    }

    await db.update(sessions).set({ isValid: false }).where(eq(sessions.userId, userId))
  },

  // ==================== FORGOT / RESET PASSWORD ====================
  async createResetToken(email: string) {
    const [user] = await db.select().from(users).where(eq(users.email, email))
    if (!user) {
      return { message: 'If email exists, reset link sent' }
    }

    const token = nanoid(32)
    await redis.setex(resetTokenKey(token), RESET_TOKEN_EXPIRY, JSON.stringify({ userId: user.id, email }))

    console.log(`[DEV] Password reset token for ${email}: ${token}`)
    
    // Send Email
    await EmailService.sendPasswordReset(email, token)

    return { message: 'If email exists, reset link sent', token }
  },

  async resetPassword(token: string, newPassword: string) {
    const cached = await redis.get(resetTokenKey(token))
    if (!cached) throw new Error('Invalid or expired reset token')

    const { userId } = JSON.parse(cached)
    const hashedPassword = await Bun.password.hash(newPassword)

    await db.update(users).set({ passwordHash: hashedPassword }).where(eq(users.id, userId))
    await redis.del(resetTokenKey(token))

    await this.revokeAllUserSessions(userId)
    return { message: 'Password reset successful' }
  },

  // ==================== GET USER ====================
  async getUserById(id: string) {
    const [user] = await db.select().from(users).where(eq(users.id, id))
    return user
  },

  async getUserByEmail(email: string) {
    const [user] = await db.select().from(users).where(eq(users.email, email))
    return user
  }
}
