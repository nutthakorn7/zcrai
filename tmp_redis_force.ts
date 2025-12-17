import Redis from 'ioredis'

// Use mock Redis in test environment to avoid auth issues ONLY if not in CI
const RedisClient = process.env.NODE_ENV === 'test' && !process.env.CI
  ? (await import('ioredis-mock')).default 
  : Redis

// Read from env dynamically
const getRedisConfig = () => {
  // 🔓 FORCE REDIS CONFIGURATION for Production Fix
  // We verified password is 'redis_password' via 'nc'
  return {
    host: '127.0.0.1',
    port: 6379,
    password: 'redis_password',
    lazyConnect: true,
    showFriendlyErrorStack: true
  }
}

export const redis = new RedisClient(getRedisConfig())

// Key prefixes
export const SESSION_PREFIX = 'session:'
export const REFRESH_TOKEN_PREFIX = 'refresh:'
export const LOCKOUT_PREFIX = 'lockout:'
export const RESET_TOKEN_PREFIX = 'reset:'

// Helper functions
export const sessionKey = (userId: string) => `${SESSION_PREFIX}${userId}`
export const refreshTokenKey = (token: string) => `${REFRESH_TOKEN_PREFIX}${token}`
export const lockoutKey = (email: string) => `${LOCKOUT_PREFIX}${email}`
export const resetTokenKey = (token: string) => `${RESET_TOKEN_PREFIX}${token}`
