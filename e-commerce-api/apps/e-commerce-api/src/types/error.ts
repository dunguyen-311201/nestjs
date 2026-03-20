import { HttpStatus } from './http-status'

/**
 * Base API error class that all custom errors extend from
 */
export class ApiError extends Error {
  statusCode: number
  status: number
  details?: unknown

  constructor(statusCode: number, message: string, details?: unknown) {
    super(message)
    this.name = this.constructor.name
    this.statusCode = statusCode
    this.details = details
    this.status = statusCode
  }
}

/**
 * Thrown when authentication is required or failed (401)
 */
export class UnauthorizedError extends ApiError {
  constructor(message = 'Unauthorized', details?: unknown) {
    super(HttpStatus.UNAUTHORIZED, message, details)
  }
}

/**
 * Thrown when user doesn't have permission to access resource (403)
 */
export class ForbiddenError extends ApiError {
  constructor(message = 'Forbidden', details?: unknown) {
    super(HttpStatus.FORBIDDEN, message, details)
  }
}

/**
 * Thrown when a resource conflicts with existing data (409)
 */
export class ConflictError extends ApiError {
  constructor(message = 'Conflict', details?: unknown) {
    super(HttpStatus.CONFLICT, message, details)
  }
}

/**
 * Thrown when rate limit is exceeded (429)
 */
export class TooManyRequestsError extends ApiError {
  constructor(message = 'Too many requests', details?: unknown) {
    super(HttpStatus.TOO_MANY_REQUESTS, message, details)
  }
}

/**
 * Thrown when a requested resource is not found (404)
 */
export class NotFoundError extends ApiError {
  constructor(message = 'Not found', details?: unknown) {
    super(HttpStatus.NOT_FOUND, message, details)
  }
}

/**
 * Thrown when client sends invalid data (400)
 */
export class BadRequestError extends ApiError {
  constructor(message = 'Bad Request', details?: unknown) {
    super(HttpStatus.BAD_REQUEST, message, details)
  }
}

/**
 * Thrown for unexpected server errors (500)
 */
export class UnexpectedError extends ApiError {
  constructor(message = 'Internal server error', details?: unknown) {
    super(HttpStatus.INTERNAL_SERVER_ERROR, message, details)
  }
}

type ClerkAPIError = {
  code: string
  message: string
  longMessage: string
  meta: Record<string, unknown>
}

export type ClerkAPIResponseError = {
  clerkError: boolean
  code: string
  status: number
  clerkTraceId: string
  errors: [ClerkAPIError]
}
