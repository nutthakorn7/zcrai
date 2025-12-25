/**
 * Integration Key Migration Script
 * 
 * This script re-encrypts all api_keys using the correct ENCRYPTION_KEY.
 * Run this on the production server after fixing the ENCRYPTION_KEY in docker-compose.prod.yml.
 * 
 * Usage: bun run scripts/migrate_keys.ts
 */

import { db } from '../infra/db'
import { apiKeys } from '../infra/db/schema'
import { eq } from 'drizzle-orm'
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'

const OLD_KEY = 'abcdefghijklmnopqrstuvwxyz123456'
const NEW_KEY = process.env.ENCRYPTION_KEY || 'zcrAI_32char_encryption_key_2024'

const ALGORITHM = 'aes-256-gcm'
const ENCODING = 'hex'
const GCM_IV_LENGTH = 12

function decrypt(text: string, key: string): string | null {
  try {
    const parts = text.split(':')
    if (parts.length !== 3) return null

    const [ivHex, authTagHex, encryptedHex] = parts
    const iv = Buffer.from(ivHex, ENCODING)
    const authTag = Buffer.from(authTagHex, ENCODING)
    const decipher = createDecipheriv(ALGORITHM, key, iv)
    decipher.setAuthTag(authTag)

    let decrypted = decipher.update(encryptedHex, ENCODING, 'utf8')
    decrypted += decipher.final('utf8')
    return decrypted
  } catch (e) {
    return null
  }
}

function encrypt(text: string, key: string): string {
  const iv = randomBytes(GCM_IV_LENGTH)
  const cipher = createCipheriv(ALGORITHM, key, iv)
  let encrypted = cipher.update(text, 'utf8', ENCODING)
  encrypted += cipher.final(ENCODING)
  const authTag = cipher.getAuthTag()
  return `${iv.toString(ENCODING)}:${authTag.toString(ENCODING)}:${encrypted}`
}

async function migrateKeys() {
  console.log('🔄 Starting key migration...')
  console.log(`   Old Key: ${OLD_KEY.slice(0, 4)}...${OLD_KEY.slice(-4)}`)
  console.log(`   New Key: ${NEW_KEY.slice(0, 4)}...${NEW_KEY.slice(-4)}`)

  const allKeys = await db.select().from(apiKeys)
  console.log(`\n📦 Found ${allKeys.length} integrations to check.\n`)

  let migratedCount = 0
  let alreadyOkCount = 0
  let failedCount = 0

  for (const key of allKeys) {
    console.log(`[${key.provider}] ${key.label} (${key.id})`)

    // Try decrypting with NEW key first
    const decryptedWithNew = decrypt(key.encryptedKey, NEW_KEY)
    if (decryptedWithNew) {
      console.log(`   ✅ Already encrypted with correct key.`)
      alreadyOkCount++
      continue
    }

    // Try decrypting with OLD key
    const decryptedWithOld = decrypt(key.encryptedKey, OLD_KEY)
    if (decryptedWithOld) {
      console.log(`   🔄 Re-encrypting with new key...`)
      const newEncrypted = encrypt(decryptedWithOld, NEW_KEY)
      
      await db.update(apiKeys)
        .set({ encryptedKey: newEncrypted })
        .where(eq(apiKeys.id, key.id))

      console.log(`   ✅ Migrated successfully.`)
      migratedCount++

    } else {
      console.log(`   ❌ FAILED: Could not decrypt with either key.`)
      failedCount++
    }
  }

  console.log('\n📊 Migration Summary:')
  console.log(`   ✅ Already OK: ${alreadyOkCount}`)
  console.log(`   🔄 Migrated:   ${migratedCount}`)
  console.log(`   ❌ Failed:     ${failedCount}`)
  console.log('\n✨ Done!')

  process.exit(0)
}

migrateKeys().catch(e => {
  console.error('Migration failed:', e)
  process.exit(1)
})
