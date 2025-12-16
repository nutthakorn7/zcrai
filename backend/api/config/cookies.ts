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
    maxAge: DEFAULTS.SESSION_DURATION,
    path: '/'
  },
  refresh: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    maxAge: DEFAULTS.SESSION_DURATION,
    path: '/auth/refresh'
  }
} as const

/**
 * Helper function to set access token cookie
 */
export function setAccessTokenCookie(cookie: any, token: string) {
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
