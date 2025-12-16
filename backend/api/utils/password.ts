/**
 * Password Utility
 * Centralized password hashing and verification to ensure consistency
 * across the entire application.
 */

const BCRYPT_COST = 10;

/**
 * Hash a password using bcrypt with consistent settings.
 * @param password - Plain text password
 * @returns Hashed password
 */
export async function hashPassword(password: string): Promise<string> {
  return Bun.password.hash(password, { 
    algorithm: 'argon2id', 
    memoryCost: 4096,
    timeCost: 3
  });
}

/**
 * Verify a password against a hash.
 * @param password - Plain text password to verify
 * @param hash - Stored hash to compare against
 * @returns true if password matches, false otherwise
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  try {
    // Debug logging for test environment issues
    if (process.env.NODE_ENV === 'test') {
       // Check if hash is a valid string
       if (!hash || typeof hash !== 'string') {
          console.error('[Password] Hash is invalid/empty:', hash)
       } else {
          // Log algorithm prefix if present
          const prefix = hash.substring(0, 10);
          // console.log(`[Password] Verifying against hash prefix: ${prefix}...`)
       }
    }
    return await Bun.password.verify(password, hash);
  } catch (error) {
    console.error('[Password] Verification error:', error);
    console.error('[Password] Problematic Hash:', hash);
    return false;
  }
}
