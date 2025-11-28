import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'

const ALGORITHM = 'aes-256-gcm'
const ENCODING = 'hex'
const IV_LENGTH = 16 // AES block size is 128 bit, but GCM uses 12 bytes usually, node generic is 16 or 12. Let's use 16 for safety or 12 for GCM standard.
// Actually for GCM, 12 bytes (96 bits) is recommended for IV.
const GCM_IV_LENGTH = 12 

export const Encryption = {
  encrypt(text: string) {
    const key = process.env.ENCRYPTION_KEY
    if (!key || key.length !== 32) {
      throw new Error('Invalid ENCRYPTION_KEY. Must be 32 characters.')
    }

    const iv = randomBytes(GCM_IV_LENGTH)
    const cipher = createCipheriv(ALGORITHM, key, iv)

    let encrypted = cipher.update(text, 'utf8', ENCODING)
    encrypted += cipher.final(ENCODING)

    const authTag = cipher.getAuthTag()

    // Return format: IV:AuthTag:EncryptedData
    return `${iv.toString(ENCODING)}:${authTag.toString(ENCODING)}:${encrypted}`
  },

  decrypt(text: string) {
    const key = process.env.ENCRYPTION_KEY
    if (!key || key.length !== 32) {
      throw new Error('Invalid ENCRYPTION_KEY. Must be 32 characters.')
    }

    const parts = text.split(':')
    if (parts.length !== 3) {
      throw new Error('Invalid encrypted text format')
    }

    const [ivHex, authTagHex, encryptedHex] = parts
    
    const iv = Buffer.from(ivHex, ENCODING)
    const authTag = Buffer.from(authTagHex, ENCODING)
    const decipher = createDecipheriv(ALGORITHM, key, iv)
    
    decipher.setAuthTag(authTag)

    let decrypted = decipher.update(encryptedHex, ENCODING, 'utf8')
    decrypted += decipher.final('utf8')

    return decrypted
  }
}
