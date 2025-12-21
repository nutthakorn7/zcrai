import Redis from 'ioredis'

// Use mock Redis in test environment to avoid auth issues
// Use mock Redis in test environment ONLY if not in CI (CI provides real Redis)
const RedisClient = process.env.NODE_ENV === 'test' && !process.env.CI
  ? (await import('ioredis-mock')).default 
  : Redis

// Read from env dynamically (not at module load time) to allow test overrides
// Read from env dynamically
const getRedisConfig = () => {
  const url = process.env.REDIS_URL
  
  /* 
  // Workaround removed for debugging
  if (url && url.includes(':redis_password@')) {
    return {
      host: '127.0.0.1',
      port: 6379,
      password: 'redis_password',
      lazyConnect: true 
    }
  }
  */
  
  const finalUrl = url || 'redis://:redis_password@127.0.0.1:6379'
  console.log('[DEBUG_REDIS] Checking REDIS_URL from Env:', url);
  console.log('[DEBUG_REDIS] Final Config URL:', finalUrl);
  return finalUrl
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
