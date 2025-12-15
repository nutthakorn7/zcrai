import { describe, expect, it, beforeAll, afterAll } from 'bun:test';
import { Encryption } from '../../utils/encryption';

describe('Encryption Utility', () => {
  const originalKey = process.env.ENCRYPTION_KEY;
  const TEST_KEY = '12345678901234567890123456789012'; // 32 chars

  beforeAll(() => {
    process.env.ENCRYPTION_KEY = TEST_KEY;
  });

  afterAll(() => {
    process.env.ENCRYPTION_KEY = originalKey;
  });

  it('should encrypt and decrypt a string correctly', () => {
    const originalText = 'Hello, World! Secret Data 123';
    const encrypted = Encryption.encrypt(originalText);
    
    expect(encrypted).not.toBe(originalText);
    expect(encrypted).toContain(':'); // Checks for IV:Tag:Data format
    
    const decrypted = Encryption.decrypt(encrypted);
    expect(decrypted).toBe(originalText);
  });

  it('should encrypt same text to different values (random IV)', () => {
    const text = 'RepeatMe';
    const enc1 = Encryption.encrypt(text);
    const enc2 = Encryption.encrypt(text);
    
    expect(enc1).not.toBe(enc2);
    
    expect(Encryption.decrypt(enc1)).toBe(text);
    expect(Encryption.decrypt(enc2)).toBe(text);
  });

  it('should throw error if key is invalid', () => {
    process.env.ENCRYPTION_KEY = 'short';
    expect(() => Encryption.encrypt('fail')).toThrow('Invalid ENCRYPTION_KEY');
    process.env.ENCRYPTION_KEY = TEST_KEY; // restore
  });

  it('should throw error for invalid ciphertext format', () => {
    expect(() => Encryption.decrypt('invalid-format')).toThrow('Invalid encrypted text format');
  });

  it('should throw error if decryption fails (tampered)', () => {
    const valid = Encryption.encrypt('secrets');
    const parts = valid.split(':');
    // Tamper with the encrypted part (last part)
    parts[2] = parts[2].substring(0, parts[2].length - 1) + '0'; 
    const tampered = parts.join(':');
    
    expect(() => Encryption.decrypt(tampered)).toThrow();
  });
});
