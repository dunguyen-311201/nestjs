/* eslint-disable @typescript-eslint/no-explicit-any */
import { FastifyReply, FastifyRequest } from 'fastify'

import env from '#env'

/**
 * Configuration for request logging
 */
interface RequestLoggerConfig {
  /**
   * Log request body (default: true, except for sensitive endpoints)
   */
  logRequestBody?: boolean

  /**
   * Log response body (default: false in production, true in development)
   */
  logResponseBody?: boolean

  /**
   * Log query parameters (default: true)
   */
  logQuery?: boolean

  /**
   * Log request headers (default: false, can expose sensitive data)
   */
  logHeaders?: boolean

  /**
   * Paths to exclude from logging
   */
  excludePaths?: string[]

  /**
   * Headers to exclude from logging (if logHeaders is true)
   */
  excludeHeaders?: string[]
}

/**
 * Default configuration
 */
const defaultConfig: RequestLoggerConfig = {
  logRequestBody: true,
  logResponseBody: env.nodeEnv === 'development',
  logQuery: true,
  logHeaders: false,
  excludePaths: ['/health', '/metrics'],
  excludeHeaders: ['authorization', 'cookie', 'x-api-key'],
}

/**
 * Sanitize sensitive data from objects
 */
function sanitizeData(data: unknown, excludeKeys: string[] = []): unknown {
  if (!data || typeof data !== 'object') {
    return data
  }

  if (Array.isArray(data)) {
    return data.map((item) => sanitizeData(item, excludeKeys))
  }

  const sanitized: Record<string, unknown> = {}
  const sensitiveKeys = [
    'password',
    'token',
    'secret',
    'apiKey',
    'authorization',
    'cookie',
    ...excludeKeys,
  ]

  for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
    const lowerKey = key.toLowerCase()
    if (sensitiveKeys.some((sensitive) => lowerKey.includes(sensitive))) {
      sanitized[key] = '[REDACTED]'
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeData(value, excludeKeys)
    } else {
      sanitized[key] = value
    }
  }

  return sanitized
}

/**
 * Check if path should be excluded from logging
 */
function shouldExcludePath(path: string, excludePaths: string[]): boolean {
  return excludePaths.some((excludePath) => path.startsWith(excludePath))
}

/**
 * Request/Response logging middleware
 * Logs incoming requests and outgoing responses with timing information
 */
export const requestLogger = (
  config: RequestLoggerConfig = {},
): ((request: FastifyRequest, _reply: FastifyReply) => Promise<void>) => {
  const finalConfig = { ...defaultConfig, ...config }

  return async (request: FastifyRequest): Promise<void> => {
    // Skip logging for excluded paths
    if (
      finalConfig.excludePaths &&
      shouldExcludePath(request.url, finalConfig.excludePaths)
    ) {
      return
    }

    const startTime = Date.now()
    const requestId =
      request.id ||
      `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

    // Prepare request log data
    const requestLogData: Record<string, unknown> = {
      requestId,
      method: request.method,
      url: request.url,
      ip: request.ip,
      userAgent: request.headers['user-agent'],
      timestamp: new Date().toISOString(),
    }

    // Add user context if available
    if (request.auth?.userId) {
      requestLogData.userId = request.auth.userId
    }

    // Add query parameters
    if (
      finalConfig.logQuery &&
      request.query &&
      Object.keys(request.query).length > 0
    ) {
      requestLogData.query = sanitizeData(request.query)
    }

    // Add request body (sanitized)
    if (
      finalConfig.logRequestBody &&
      request.body &&
      request.method !== 'GET' &&
      request.method !== 'HEAD'
    ) {
      requestLogData.body = sanitizeData(request.body)
    }

    // Add headers (sanitized and filtered)
    if (finalConfig.logHeaders && request.headers) {
      const headers: Record<string, unknown> = {}
      const excludeHeaders = finalConfig.excludeHeaders || []

      for (const [key, value] of Object.entries(request.headers)) {
        const lowerKey = key.toLowerCase()
        if (!excludeHeaders.includes(lowerKey)) {
          headers[key] = sanitizeData(value)
        } else {
          headers[key] = '[REDACTED]'
        }
      }
      requestLogData.headers = headers
    }

    // Log incoming request
    request.log.info(requestLogData, 'Incoming request')

    // Store start time in request context for response logging
    ;(request as any).__requestStartTime = startTime
    ;(request as any).__requestId = requestId
  }
}

/**
 * Response logging hook
 * Should be registered as 'onSend' hook on Fastify instance
 */
export const responseLogger = (
  config: RequestLoggerConfig = {},
): ((
  request: FastifyRequest,
  reply: FastifyReply,
  payload: unknown,
  done: () => void,
) => void) => {
  const finalConfig = { ...defaultConfig, ...config }

  return (
    request: FastifyRequest,
    reply: FastifyReply,
    payload: unknown,
    done: () => void,
  ): void => {
    const startTime = (request as any).__requestStartTime as number | undefined
    const requestId = (request as any).__requestId as string | undefined

    if (!startTime || !requestId) {
      done()
      return
    }

    const duration = Date.now() - startTime
    const responseLogData: Record<string, unknown> = {
      requestId,
      method: request.method,
      url: request.url,
      statusCode: reply.statusCode,
      duration: `${duration}ms`,
      durationMs: duration,
      timestamp: new Date().toISOString(),
    }

    // Add user context if available
    if (request.auth?.userId) {
      responseLogData.userId = request.auth.userId
    }

    // Add response size if available
    if (payload && typeof payload === 'string') {
      responseLogData.responseSize = `${payload.length} bytes`
    }

    // Add response body in development mode
    if (finalConfig.logResponseBody && env.nodeEnv === 'development') {
      try {
        if (payload && typeof payload === 'string') {
          const parsed = JSON.parse(payload)
          responseLogData.responseBody = sanitizeData(parsed)
        }
      } catch {
        // Ignore parsing errors
      }
    }

    // Determine log level based on status code
    if (reply.statusCode >= 500) {
      request.log.error(responseLogData, 'Request completed with server error')
    } else if (reply.statusCode >= 400) {
      request.log.warn(responseLogData, 'Request completed with client error')
    } else if (duration > 1000) {
      request.log.warn(responseLogData, 'Request completed (slow)')
    } else {
      request.log.info(responseLogData, 'Request completed')
    }

    done()
  }
}

/**
 * Default request logger instance
 * Use this for most cases
 */
export const defaultRequestLogger = requestLogger()

/**
 * Request logger that excludes sensitive paths
 * Use this for production
 */
export const productionRequestLogger = requestLogger({
  logRequestBody: false,
  logResponseBody: false,
  logHeaders: false,
  excludePaths: ['/health', '/metrics', '/api/v1/checkout/webhook'],
})
