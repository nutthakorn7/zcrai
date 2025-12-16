/**
 * Application Constants
 * Centralized configuration values to avoid magic numbers
 */

export const DEFAULTS = {
  // Pagination
  PAGINATION_LIMIT: 100,
  PAGINATION_MAX_LIMIT: 1000,
  
  // Session & Token Durations (in seconds)
  SESSION_DURATION: 7 * 24 * 60 * 60,  // 7 days
  ACCESS_TOKEN_EXPIRY: '15m',
  REFRESH_TOKEN_EXPIRY: '7d',
  RESET_TOKEN_EXPIRY: 60 * 60,  // 1 hour
  
  // Rate Limiting
  RATE_LIMIT_WINDOW: 60 * 1000,  // 1 minute
  RATE_LIMIT_MAX_REQUESTS: 100,
  
  // File Upload
  MAX_FILE_SIZE: 10 * 1024 * 1024,  // 10MB
  ALLOWED_FILE_TYPES: ['pdf', 'png', 'jpg', 'jpeg', 'txt', 'log', 'json'],
  
  // Backup
  BACKUP_RETENTION_DAYS: 7,
  BACKUP_DIR: '/app/backups',
  
  // Alerts
  ALERT_CORRELATION_WINDOW: 5 * 60,  // 5 minutes
  MAX_CORRELATED_ALERTS: 50,
  
  // License
  FREE_TIER: {
    maxUsers: 5,
    maxRetentionDays: 7,
    maxDataVolumeGB: 10
  }
}

export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  INTERNAL_SERVER_ERROR: 500,
  NOT_IMPLEMENTED: 501
} as const

export const ERROR_CODES = {
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  INSUFFICIENT_PERMISSIONS: 'INSUFFICIENT_PERMISSIONS',
  RESOURCE_NOT_FOUND: 'RESOURCE_NOT_FOUND',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  DUPLICATE_RESOURCE: 'DUPLICATE_RESOURCE',
  UPGRADE_REQUIRED: 'UPGRADE_REQUIRED'
} as const
