/**
 * Global Error Handler Middleware
 * Centralized error handling to eliminate repetitive try-catch blocks
 */

import { Elysia } from 'elysia'
import { HTTP_STATUS, ERROR_CODES } from '../config/constants'

export interface APIError extends Error {
  code?: string
  status?: number
  details?: any
}

/**
 * Create a custom API error
 */
export function createError(message: string, status: number = HTTP_STATUS.INTERNAL_SERVER_ERROR, code?: string): APIError {
  const error = new Error(message) as APIError
  error.status = status
  error.code = code
  return error
}

/**
 * Global error handler middleware
 * Catches all errors and returns consistent error responses
 */
export const errorHandler = (app: Elysia) => {
  return app.onError(({ code, error, set, request }) => {
    const err = error as any // Type assertion for Elysia error types

    // Custom API errors with status
    if ((err as APIError).status) {
      set.status = err.status || HTTP_STATUS.INTERNAL_SERVER_ERROR
      return {
        success: false,
        error: err.message,
        code: err.code,
        details: err.details
      }
    }

    // Elysia built-in error codes
    switch (code) {
      case 'VALIDATION':
        set.status = HTTP_STATUS.BAD_REQUEST
        return {
          success: false,
          error: 'Validation failed',
          code: ERROR_CODES.VALIDATION_ERROR,
          details: err.message
        }

      case 'NOT_FOUND':
        set.status = HTTP_STATUS.NOT_FOUND
        return {
          success: false,
          error: 'Resource not found',
          code: ERROR_CODES.RESOURCE_NOT_FOUND
        }

      case 'PARSE':
        set.status = HTTP_STATUS.BAD_REQUEST
        return {
          success: false,
          error: 'Invalid request format',
          code: ERROR_CODES.VALIDATION_ERROR
        }

      case 'UNKNOWN':
      default:
        // Log unexpected errors
        console.error('[Global Error Handler]', {
          code,
          message: err.message,
          method: request.method,
          url: request.url,
          stack: err.stack
        })

        set.status = HTTP_STATUS.INTERNAL_SERVER_ERROR
        return {
          success: false,
          error: process.env.NODE_ENV === 'production' 
            ? 'Internal server error' 
            : err.message,
          code: 'INTERNAL_ERROR'
        }
    }
  })
}

/**
 * Predefined error factories
 */
export const Errors = {
  Unauthorized: (message = 'Unauthorized') => 
    createError(message, HTTP_STATUS.UNAUTHORIZED, ERROR_CODES.INVALID_CREDENTIALS),
  
  Forbidden: (message = 'Forbidden') => 
    createError(message, HTTP_STATUS.FORBIDDEN, ERROR_CODES.INSUFFICIENT_PERMISSIONS),
  
  NotFound: (resource: string) => 
    createError(`${resource} not found`, HTTP_STATUS.NOT_FOUND, ERROR_CODES.RESOURCE_NOT_FOUND),
  
  BadRequest: (message: string) => 
    createError(message, HTTP_STATUS.BAD_REQUEST, ERROR_CODES.VALIDATION_ERROR),
  
  Conflict: (message: string) => 
    createError(message, HTTP_STATUS.CONFLICT, ERROR_CODES.DUPLICATE_RESOURCE),
  
  UpgradeRequired: (message: string) => 
    createError(message, HTTP_STATUS.FORBIDDEN, ERROR_CODES.UPGRADE_REQUIRED),
  
  TokenExpired: () => 
    createError('Token expired', HTTP_STATUS.UNAUTHORIZED, ERROR_CODES.TOKEN_EXPIRED),

  TooManyRequests: (message = 'Too many requests') =>
    createError(message, 429, 'RATE_LIMIT_EXCEEDED')
}
