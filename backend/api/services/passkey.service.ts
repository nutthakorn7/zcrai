/**
 * Passkey Service
 * Handles WebAuthn registration and authentication using @simplewebauthn/server
 */

import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from '@simplewebauthn/server'
import type {
  RegistrationResponseJSON,
  AuthenticationResponseJSON,
} from '@simplewebauthn/server'
import { db } from '../infra/db'
import { userPasskeys, users } from '../infra/db/schema'
import { eq } from 'drizzle-orm'
import { redis } from '../infra/cache/redis'

// WebAuthn configuration
const RP_NAME = 'zcrAI'
const RP_ID = process.env.NODE_ENV === 'production' ? 'app.zcr.ai' : 'localhost'
const ORIGIN = process.env.NODE_ENV === 'production' 
  ? 'https://app.zcr.ai' 
  : 'http://localhost:5173'

export class PasskeyService {
  /**
   * Generate registration options for creating a new passkey
   */
  static async generateRegistrationOptions(userId: string, userEmail: string) {
    // Get existing passkeys for this user
    const existingPasskeys = await db.select()
      .from(userPasskeys)
      .where(eq(userPasskeys.userId, userId))

    const options = await generateRegistrationOptions({
      rpName: RP_NAME,
      rpID: RP_ID,
      userName: userEmail,
      userDisplayName: userEmail.split('@')[0],
      // Exclude existing credentials
      excludeCredentials: existingPasskeys.map(passkey => ({
        id: passkey.credentialId,
        transports: passkey.transports ? JSON.parse(passkey.transports) : undefined,
      })),
      authenticatorSelection: {
        // Prefer platform authenticators (TouchID, FaceID, Windows Hello)
        authenticatorAttachment: 'platform',
        userVerification: 'preferred',
        residentKey: 'preferred',
      },
      timeout: 60000,
    })

    // Store challenge in Redis for verification (expires in 5 minutes)
    await redis.setex(`passkey:reg:${userId}`, 300, options.challenge)

    return options
  }

  /**
   * Verify registration response and store the passkey
   */
  static async verifyRegistration(
    userId: string,
    response: RegistrationResponseJSON,
    deviceName?: string
  ) {
    // Get the stored challenge
    const expectedChallenge = await redis.get(`passkey:reg:${userId}`)
    if (!expectedChallenge) {
      throw new Error('Registration challenge expired or not found')
    }

    const verification = await verifyRegistrationResponse({
      response,
      expectedChallenge,
      expectedOrigin: ORIGIN,
      expectedRPID: RP_ID,
    })

    if (!verification.verified || !verification.registrationInfo) {
      throw new Error('Passkey registration verification failed')
    }

    const { credential, credentialDeviceType } = verification.registrationInfo

    // Store the passkey in database
    await db.insert(userPasskeys).values({
      userId,
      credentialId: credential.id,
      publicKey: Buffer.from(credential.publicKey).toString('base64'),
      counter: credential.counter,
      deviceType: credentialDeviceType,
      transports: response.response.transports 
        ? JSON.stringify(response.response.transports) 
        : null,
      name: deviceName || 'Passkey',
    })

    // Clean up challenge
    await redis.del(`passkey:reg:${userId}`)

    return { verified: true }
  }

  /**
   * Generate authentication options for login
   */
  static async generateAuthenticationOptions(userEmail?: string) {
    let allowCredentials: { id: string; transports?: any[] }[] = []

    if (userEmail) {
      // Get user's passkeys
      const user = await db.select().from(users).where(eq(users.email, userEmail)).limit(1)
      if (user.length > 0) {
        const passkeys = await db.select()
          .from(userPasskeys)
          .where(eq(userPasskeys.userId, user[0].id))

        allowCredentials = passkeys.map(p => ({
          id: p.credentialId,
          transports: p.transports ? JSON.parse(p.transports) : undefined,
        }))
      }
    }

    const options = await generateAuthenticationOptions({
      rpID: RP_ID,
      allowCredentials: allowCredentials.length > 0 ? allowCredentials : undefined,
      userVerification: 'preferred',
      timeout: 60000,
    })

    // Store challenge in Redis
    const challengeKey = userEmail || 'anonymous'
    await redis.setex(`passkey:auth:${challengeKey}`, 300, options.challenge)

    return options
  }

  /**
   * Verify authentication response and return user
   */
  static async verifyAuthentication(
    response: AuthenticationResponseJSON,
    userEmail?: string
  ) {
    // Find the passkey by credential ID
    const passkey = await db.select()
      .from(userPasskeys)
      .where(eq(userPasskeys.credentialId, response.id))
      .limit(1)

    if (passkey.length === 0) {
      throw new Error('Passkey not found')
    }

    // Get user
    const user = await db.select()
      .from(users)
      .where(eq(users.id, passkey[0].userId))
      .limit(1)

    if (user.length === 0) {
      throw new Error('User not found')
    }

    // Get stored challenge
    const challengeKey = userEmail || 'anonymous'
    const expectedChallenge = await redis.get(`passkey:auth:${challengeKey}`)
    if (!expectedChallenge) {
      throw new Error('Authentication challenge expired or not found')
    }

    const verification = await verifyAuthenticationResponse({
      response,
      expectedChallenge,
      expectedOrigin: ORIGIN,
      expectedRPID: RP_ID,
      credential: {
        id: passkey[0].credentialId,
        publicKey: Buffer.from(passkey[0].publicKey, 'base64'),
        counter: passkey[0].counter,
      },
    })

    if (!verification.verified) {
      throw new Error('Passkey authentication failed')
    }

    // Update counter and last used timestamp
    await db.update(userPasskeys)
      .set({
        counter: verification.authenticationInfo.newCounter,
        lastUsedAt: new Date(),
      })
      .where(eq(userPasskeys.id, passkey[0].id))

    // Clean up challenge
    await redis.del(`passkey:auth:${challengeKey}`)

    return user[0]
  }

  /**
   * Get all passkeys for a user
   */
  static async getUserPasskeys(userId: string) {
    return db.select({
      id: userPasskeys.id,
      name: userPasskeys.name,
      deviceType: userPasskeys.deviceType,
      lastUsedAt: userPasskeys.lastUsedAt,
      createdAt: userPasskeys.createdAt,
    })
    .from(userPasskeys)
    .where(eq(userPasskeys.userId, userId))
  }

  /**
   * Delete a passkey
   */
  static async deletePasskey(userId: string, passkeyId: string) {
    const result = await db.delete(userPasskeys)
      .where(eq(userPasskeys.id, passkeyId))
      .returning()

    if (result.length === 0) {
      throw new Error('Passkey not found')
    }

    // Verify the passkey belonged to this user
    if (result[0].userId !== userId) {
      throw new Error('Unauthorized')
    }

    return { deleted: true }
  }
}
