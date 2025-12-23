import * as OTPAuth from 'otpauth'
import QRCode from 'qrcode'
import { nanoid } from 'nanoid'
import { db } from '../../infra/db'
import { users } from '../../infra/db/schema'
import { eq } from 'drizzle-orm'
import { redis } from '../../infra/cache/redis'

const mfaSetupKey = (userId: string) => `mfa:setup:${userId}`

const APP_NAME = 'zcrAI'
const BACKUP_CODES_COUNT = 10

export const MFAService = {
  // Setup MFA - สร้าง QR Code และ Secret
  async setup(userId: string, userEmail: string) {
    const totp = new OTPAuth.TOTP({
      issuer: APP_NAME,
      label: userEmail,
      algorithm: 'SHA1',
      digits: 6,
      period: 30,
      secret: new OTPAuth.Secret({ size: 20 }),
    })

    const secret = totp.secret.base32
    const otpauthUrl = totp.toString()
    const qrCode = await QRCode.toDataURL(otpauthUrl)
    const backupCodes = Array.from({ length: BACKUP_CODES_COUNT }, () => nanoid(8).toUpperCase())

    return { secret, qrCode, backupCodes, otpauthUrl }
  },

  async enable(userId: string) {
     const [user] = await db.select().from(users).where(eq(users.id, userId))
     if (!user) throw new Error('User not found')

     const { secret, qrCode, otpauthUrl, backupCodes } = await this.setup(userId, user.email)
     
     // Store pending secret for verification (10 mins)
     await redis.setex(mfaSetupKey(userId), 600, JSON.stringify({ secret, backupCodes }))
     
     return { secret, qrCode, otpauthUrl } 
  },

  async verifySetup(userId: string, code: string) {
     const cached = await redis.get(mfaSetupKey(userId))
     if (!cached) throw new Error('MFA setup expired or not initiated')
     
     const { secret, backupCodes } = JSON.parse(cached)
     
     // Verify
     await this.verifyAndEnable(userId, secret, code, backupCodes)
     
     // Cleanup
     await redis.del(mfaSetupKey(userId))
     
     return { backupCodes }
  },

  // Verify และ Enable MFA
  async verifyAndEnable(userId: string, secret: string, code: string, backupCodes: string[]) {
    const totp = new OTPAuth.TOTP({
      algorithm: 'SHA1',
      digits: 6,
      period: 30,
      secret: OTPAuth.Secret.fromBase32(secret),
    })

    const isValid = totp.validate({ token: code, window: 1 }) !== null
    if (!isValid) {
      throw new Error('Invalid verification code')
    }

    await db.update(users).set({
      mfaEnabled: true,
      mfaSecret: secret,
    }).where(eq(users.id, userId))

    return { message: 'MFA enabled successfully' }
  },

  // Verify MFA Code (Login)
  async verifyCode(userId: string, code: string) {
    const [user] = await db.select().from(users).where(eq(users.id, userId))
    if (!user || !user.mfaSecret) {
      throw new Error('MFA not configured')
    }

    const totp = new OTPAuth.TOTP({
      algorithm: 'SHA1',
      digits: 6,
      period: 30,
      secret: OTPAuth.Secret.fromBase32(user.mfaSecret),
    })

    const isValid = totp.validate({ token: code, window: 1 }) !== null
    if (!isValid) {
      throw new Error('Invalid MFA code')
    }

    return true
  },

  // Disable MFA
  async disable(userId: string, password: string) {
    const [user] = await db.select().from(users).where(eq(users.id, userId))
    if (!user) throw new Error('User not found')

    const isValid = await Bun.password.verify(password, user.passwordHash)
    if (!isValid) throw new Error('Invalid password')

    await db.update(users).set({
      mfaEnabled: false,
      mfaSecret: null,
    }).where(eq(users.id, userId))

    return { message: 'MFA disabled successfully' }
  },

  // Check MFA Status
  async isEnabled(userId: string): Promise<boolean> {
    const [user] = await db.select().from(users).where(eq(users.id, userId))
    return user?.mfaEnabled || false
  }
}
