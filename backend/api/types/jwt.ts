/**
 * JWT Payload Types
 * Standardized JWT payload structure
 */

export interface JWTUserPayload {
  /** Primary user ID (use this for all user identification) */
  id: string
  
  /** Tenant ID */
  tenantId: string
  
  /** User role */
  role: 'superadmin' | 'admin' | 'analyst' | 'viewer'
  
  /** Issued at timestamp */
  iat?: number
  
  /** Expiration timestamp */
  exp?: number
}

/**
 * Type guard to check if payload is valid
 */
export function isValidJWTPayload(payload: any): payload is JWTUserPayload {
  return (
    payload &&
    typeof payload.id === 'string' &&
    typeof payload.tenantId === 'string' &&
    typeof payload.role === 'string'
  )
}
