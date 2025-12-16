import { Cookie } from 'elysia'
import { JWTUserPayload } from './jwt'

/**
 * Base Elysia context interface
 * Represents the standard context object passed to route handlers
 */
export interface ElysiaContext<TBody = unknown> {
  body: TBody
  query: Record<string, string | string[] | undefined>
  params: Record<string, string>
  headers: Headers
  request: Request
  set: {
    status?: number
    headers?: Record<string, string>
    redirect?: string
  }
  cookie: Record<string, Cookie<any>>
  path: string
  url: URL
}

/**
 * Authenticated context interface
 * Used in routes protected by withAuth or other auth middlewares
 */
export interface AuthContext<TBody = unknown> extends ElysiaContext<TBody> {
  user: JWTUserPayload
  jwt?: any // JWT instance from @elysiajs/jwt
}

/**
 * Context with JWT utilities
 * Used in routes that need direct access to JWT signing/verification
 */
export interface JWTContext<TBody = unknown> extends ElysiaContext<TBody> {
  jwt: {
    sign: (payload: any) => Promise<string>
    verify: (token: string) => Promise<any>
  }
}

/**
 * Full authenticated context with JWT utilities
 */
export interface FullAuthContext<TBody = unknown> extends AuthContext<TBody> {
  jwt: {
    sign: (payload: any) => Promise<string>
    verify: (token: string) => Promise<any>
  }
}

/**
 * Type guard to check if context has authenticated user
 */
export function isAuthContext(ctx: ElysiaContext): ctx is AuthContext {
  return 'user' in ctx && ctx.user !== undefined && ctx.user !== null
}

/**
 * Type guard to check if context has JWT utilities
 */
export function hasJWT(ctx: ElysiaContext): ctx is JWTContext {
  return 'jwt' in ctx && ctx.jwt !== undefined
}
