import Redis from 'ioredis'

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379'

export const redis = new Redis(redisUrl)

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
