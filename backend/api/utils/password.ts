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
    algorithm: 'bcrypt', 
    cost: BCRYPT_COST 
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
    return await Bun.password.verify(password, hash);
  } catch (error) {
    console.error('[Password] Verification error:', error);
    return false;
  }
}
