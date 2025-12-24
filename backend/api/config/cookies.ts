/**
 * Cookie Configuration
 * Centralized cookie settings for access and refresh tokens
 */

import { DEFAULTS } from './constants'

export const COOKIE_CONFIG = {
  access: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    maxAge: DEFAULTS.SESSION_DURATION * 1000, 
    path: '/'
  },
  refresh: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    maxAge: DEFAULTS.SESSION_DURATION * 1000, 
    path: '/auth/refresh'
  }
} as const





/**
 * Helper function to set access token cookie
 */
export function setAccessTokenCookie(cookie: any, token: string) {
  console.log('🍪 [Config] Setting access_token cookie:', {
    httpOnly: COOKIE_CONFIG.access.httpOnly,
    secure: COOKIE_CONFIG.access.secure,
    sameSite: COOKIE_CONFIG.access.sameSite,
    path: COOKIE_CONFIG.access.path,
    tokenPrefix: token.substring(0, 10) + '...'
  });
  cookie.set({
    ...COOKIE_CONFIG.access,
    value: token
  })
}


/**
 * Helper function to set refresh token cookie
 */
export function setRefreshTokenCookie(cookie: any, token: string) {
  cookie.set({
    ...COOKIE_CONFIG.refresh,
    value: token
  })
}

/**
 * Helper function to clear all auth cookies
 */
export function clearAuthCookies(accessToken: any, refreshToken: any) {
  accessToken.remove()
  refreshToken.remove()
}
