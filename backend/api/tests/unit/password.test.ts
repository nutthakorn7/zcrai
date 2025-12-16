import { describe, expect, it } from 'bun:test';
import { hashPassword, verifyPassword } from '../../utils/password';

describe('Password Utility', () => {
  it('should hash a password correctly', async () => {
    const password = 'SuperSecretPassword123!';
    const hash = await hashPassword(password);
    
    expect(hash).toBeDefined();
    expect(typeof hash).toBe('string');
    expect(hash).not.toBe(password);
    expect(hash.startsWith('$argon2')).toBe(true); // argon2 prefix
  });

  it('should verify a correct password', async () => {
    const password = 'CorrectPassword';
    const hash = await hashPassword(password);
    const isValid = await verifyPassword(password, hash);
    
    expect(isValid).toBe(true);
  });

  it('should reject an incorrect password', async () => {
    const password = 'MyPassword';
    const hash = await hashPassword(password);
    const isValid = await verifyPassword('WrongPassword', hash);
    
    expect(isValid).toBe(false);
  });

  it('should reject empty passwords', async () => {
    // Bun.password.hash throws on empty string
    const password = '';
    expect(hashPassword(password)).rejects.toThrow();
  });
});
