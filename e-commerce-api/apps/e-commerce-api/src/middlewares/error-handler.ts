import { FastifyError, FastifyReply, FastifyRequest } from 'fastify'

import { Response } from '#utils/response'

import { ApiError, HttpStatus } from '#types'

export const errorHandler = (
  error: FastifyError | ApiError | Error,
  request: FastifyRequest,
  reply: FastifyReply,
): void => {
  const errorContext = {
    err: error,
    url: request.url,
    method: request.method,
    statusCode:
      (error as ApiError).statusCode || HttpStatus.INTERNAL_SERVER_ERROR,
    userId: request.auth?.userId,
    ip: request.ip,
    userAgent: request.headers['user-agent'],
    timestamp: new Date().toISOString(),
  }

  request.log.error(errorContext, 'Request error')

  if (error instanceof ApiError) {
    return handleApiError(error, reply)
  }

  if ('validation' in error && error.validation) {
    return handleValidationError(error as FastifyError, reply)
  }

  if (isDatabaseError(error)) {
    return handleDatabaseError(error, reply)
  }

  if (error instanceof Error) {
    return handleGenericError(error, reply)
  }

  Response.sendInternalError(reply, 'An unexpected error occurred')
}

function handleApiError(error: ApiError, reply: FastifyReply): void {
  const { statusCode, message, details } = error

  switch (statusCode) {
    case HttpStatus.BAD_REQUEST:
      Response.sendBadRequest(reply, message, details)
      break

    case HttpStatus.UNAUTHORIZED:
      Response.sendUnauthorized(reply, message, details)
      break

    case HttpStatus.FORBIDDEN:
      Response.sendForbidden(reply, message, details)
      break

    case HttpStatus.NOT_FOUND:
      Response.sendNotFound(reply, message, details)
      break

    case HttpStatus.CONFLICT:
      Response.sendError(reply, HttpStatus.CONFLICT, message, details)
      break

    case HttpStatus.TOO_MANY_REQUESTS:
      Response.sendError(reply, HttpStatus.TOO_MANY_REQUESTS, message, details)
      break

    case HttpStatus.INTERNAL_SERVER_ERROR:
      Response.sendInternalError(reply, message, details)
      break

    default:
      Response.sendError(reply, statusCode, message, details)
  }
}

function handleValidationError(error: FastifyError, reply: FastifyReply): void {
  const validationErrors = error.validation || []
  const errorMessages = validationErrors.map((err) => ({
    field: err.instancePath || err.params?.missingProperty || 'unknown',
    message: err.message || 'Validation failed',
  }))

  Response.sendBadRequest(reply, 'Validation failed', {
    validation: errorMessages,
  })
}

function handleDatabaseError(error: Error, reply: FastifyReply): void {
  const isDevelopment = process.env.NODE_ENV === 'development'

  if (isDevelopment) {
    Response.sendInternalError(reply, 'Database error', {
      message: error.message,
      stack: error.stack,
    })
  } else {
    Response.sendInternalError(reply, 'A database error occurred')
  }
}

function handleGenericError(error: Error, reply: FastifyReply): void {
  const isDevelopment = process.env.NODE_ENV === 'development'

  if (isDevelopment) {
    Response.sendInternalError(reply, error.message || 'An error occurred', {
      name: error.name,
      stack: error.stack,
    })
  } else {
    Response.sendInternalError(reply, 'An unexpected error occurred')
  }
}

function isDatabaseError(error: unknown): boolean {
  if (!(error instanceof Error)) return false

  const errorMessage = error.message.toLowerCase()
  const databaseIndicators = [
    'sql',
    'database',
    'connection',
    'query',
    'typeorm',
    'constraint',
    'foreign key',
    'unique constraint',
    'duplicate',
    'null value',
    'not-null',
    'violates',
  ]

  return databaseIndicators.some((indicator) =>
    errorMessage.includes(indicator),
  )
}

export const asyncHandler = <T extends unknown[]>(
  fn: (...args: T) => Promise<void>,
) => {
  return async (...args: T): Promise<void> => {
    try {
      await fn(...args)
    } catch (error) {
      const request = args[0] as FastifyRequest
      const reply = args[1] as FastifyReply

      errorHandler(error as Error, request, reply)
    }
  }
}
