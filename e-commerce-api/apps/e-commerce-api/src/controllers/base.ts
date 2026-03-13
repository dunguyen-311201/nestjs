import type { FastifyReply, FastifyRequest } from 'fastify'

import { ApiResponseBuilder } from '#utils/response'

import type { Pagination } from '#types'

type SuccessMeta = {
  pagination?: Pagination
  [key: string]: unknown
}

export class BaseController {
  protected sendSuccess<T>(
    reply: FastifyReply,
    data: T,
    meta?: SuccessMeta,
  ): void {
    ApiResponseBuilder.sendSuccess(reply, data, meta)
  }

  protected sendItem<T>(reply: FastifyReply, data: T): void {
    ApiResponseBuilder.sendItem(reply, data)
  }

  protected sendCreated<T>(
    reply: FastifyReply,
    data: T,
    meta?: SuccessMeta,
  ): void {
    ApiResponseBuilder.sendCreated(reply, data, meta)
  }

  protected sendCreatedItem<T>(reply: FastifyReply, data: T): void {
    ApiResponseBuilder.sendCreatedItem(reply, data)
  }

  protected sendPaginated<T>(
    reply: FastifyReply,
    data: T[],
    pagination: Pagination,
    additionalMeta?: Record<string, unknown>,
  ): void {
    ApiResponseBuilder.sendPaginated(reply, data, pagination, additionalMeta)
  }

  protected sendNoContent(reply: FastifyReply): void {
    ApiResponseBuilder.sendNoContent(reply)
  }

  protected sendBadRequest(
    reply: FastifyReply,
    message: string,
    details?: unknown,
  ): void {
    ApiResponseBuilder.sendBadRequest(reply, message, details)
  }

  protected sendUnauthorized(
    reply: FastifyReply,
    message: string = 'Unauthorized',
    details?: unknown,
  ): void {
    ApiResponseBuilder.sendUnauthorized(reply, message, details)
  }

  protected sendForbidden(
    reply: FastifyReply,
    message: string = 'Forbidden',
    details?: unknown,
  ): void {
    ApiResponseBuilder.sendForbidden(reply, message, details)
  }

  protected sendNotFound(
    reply: FastifyReply,
    message: string = 'Resource not found',
    details?: unknown,
  ): void {
    ApiResponseBuilder.sendNotFound(reply, message, details)
  }

  protected sendInternalError(
    reply: FastifyReply,
    message: string = 'Internal server error',
    details?: unknown,
  ): void {
    ApiResponseBuilder.sendInternalError(reply, message, details)
  }

  protected sendError(
    reply: FastifyReply,
    statusCode: number,
    message: string,
    details?: unknown,
  ): void {
    ApiResponseBuilder.sendError(reply, statusCode, message, details)
  }

  protected log(
    request: FastifyRequest,
    message: string,
    ...args: unknown[]
  ): void {
    if (args.length === 0) {
      request.log?.info?.(message)
    } else {
      ;(
        request.log as { info: (msg: string, ...a: unknown[]) => void }
      )?.info?.(message, ...args)
    }
  }

  protected logError(
    request: FastifyRequest,
    message: string,
    error?: unknown,
  ): void {
    const log = request.log as
      | { error: (a: unknown, b?: string) => void }
      | undefined
    if (!log) return
    if (error !== undefined) {
      log.error(error, message)
    } else {
      log.error(message)
    }
  }
}
