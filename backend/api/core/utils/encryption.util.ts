import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'node:crypto';

// The ALGORITHM used for encryption
const ALGORITHM = 'aes-256-gcm';

// Derive a 32-byte key from the environment variable or a default (for development only)
// In production, ENCRYPTION_KEY MUST be set and be high entropy.
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'zcrAI-default-secret-key-32-chars-!!';
const KEY = scryptSync(ENCRYPTION_KEY, 'zcr-salt-2025', 32);

/**
 * EncryptionUtil provides methods to securely encrypt and decrypt strings
 * using AES-256-GCM.
 */
export const EncryptionUtil = {
  /**
   * Encrypts a plain text string
   * @param text The string to encrypt
   * @returns Formatted string as "iv:authTag:encryptedContent"
   */
  encrypt(text: string): string {
    const iv = randomBytes(12); // GCM standard IV size is 12 bytes
    const cipher = createCipheriv(ALGORITHM, KEY, iv);
    
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag().toString('hex');
    
    return `${iv.toString('hex')}:${authTag}:${encrypted}`;
  },

  /**
   * Decrypts an encrypted string
   * @param encryptedData The string in "iv:authTag:encryptedContent" format
   * @returns The original plain text string
   */
  decrypt(encryptedData: string): string {
    try {
      const [ivHex, authTagHex, encryptedHex] = encryptedData.split(':');
      
      if (!ivHex || !authTagHex || !encryptedHex) {
        throw new Error('Invalid encrypted data format');
      }

      const iv = Buffer.from(ivHex, 'hex');
      const authTag = Buffer.from(authTagHex, 'hex');
      const decipher = createDecipheriv(ALGORITHM, KEY, iv);
      
      decipher.setAuthTag(authTag);
      
      let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      return decrypted;
    } catch (e) {
      console.error('[EncryptionUtil] Decryption failed:', e);
      throw new Error('Could not decrypt data. Key might be incorrect or data is corrupted.');
    }
  }
};
