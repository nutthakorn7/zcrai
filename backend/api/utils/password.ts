/**
 * Password Utility
 * Centralized password hashing and verification to ensure consistency
 * across the entire application.
 */

const BCRYPT_COST = 10;

/**
 * Hash a password using Argon2id with optimized settings.
 * @param password - Plain text password
 * @returns Hashed password
 */
export async function hashPassword(password: string): Promise<string> {
  const start = Date.now();
  const hash = await Bun.password.hash(password, { 
    algorithm: 'argon2id', 
    memoryCost: 4096,
    timeCost: 3
  });
  console.log(`[Password] Hash took ${Date.now() - start}ms`);
  return hash;
}

/**
 * Verify a password against a hash.
 * @param password - Plain text password to verify
 * @param hash - Stored hash to compare against
 * @returns true if password matches, false otherwise
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  const start = Date.now();
  try {
    // Debug logging for test environment issues
    if (process.env.NODE_ENV === 'test') {
       // Check if hash is a valid string
       if (!hash || typeof hash !== 'string') {
          console.error('[Password] Hash is invalid/empty:', hash)
       }
    }
    const result = await Bun.password.verify(password, hash);
    const duration = Date.now() - start;
    if (duration > 200) {
      console.warn(`[Password] Verify took ${duration}ms (slow)`);
    } else {
      console.log(`[Password] Verify took ${duration}ms`);
    }
    return result;
  } catch (error) {
    console.error('[Password] Verification error:', error);
    console.error('[Password] Problematic Hash:', hash);
    return false;
  }
}

