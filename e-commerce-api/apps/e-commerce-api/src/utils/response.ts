import { FastifyReply } from 'fastify'

import { HttpStatus, Pagination } from '#types'

export interface ApiResponseSuccess<T = unknown> {
  data: T
  meta?: {
    pagination?: Pagination
    [key: string]: unknown
  }
}

export interface ApiResponseError {
  message: string
  status: number
  details?: unknown
}

export type ApiResponse<T = unknown> = ApiResponseSuccess<T> | ApiResponseError

export class ApiResponseBuilder {
  static success<T>(
    data: T,
    meta?: ApiResponseSuccess['meta'],
  ): ApiResponseSuccess<T> {
    const response: ApiResponseSuccess<T> = {
      data,
    }
    if (meta) {
      response.meta = meta
    }
    return response
  }

  static paginated<T>(
    data: T[],
    pagination: Pagination,
    additionalMeta?: Record<string, unknown>,
  ): ApiResponseSuccess<T[]> {
    return {
      data,
      meta: {
        pagination,
        ...additionalMeta,
      },
    }
  }

  static error(
    message: string,
    statusCode: number,
    details?: unknown,
  ): ApiResponseError {
    const response: ApiResponseError = {
      message,
      status: statusCode,
    }
    if (details) {
      response.details = details
    }
    return response
  }

  static sendSuccess<T>(
    reply: FastifyReply,
    data: T,
    meta?: ApiResponseSuccess['meta'],
  ): void {
    reply.status(HttpStatus.OK).send(this.success(data, meta))
  }

  static sendItem<T>(reply: FastifyReply, data: T): void {
    reply.status(HttpStatus.OK).send(data)
  }

  static sendCreated<T>(
    reply: FastifyReply,
    data: T,
    meta?: ApiResponseSuccess['meta'],
  ): void {
    reply.status(HttpStatus.CREATED).send(this.success(data, meta))
  }

  static sendCreatedItem<T>(reply: FastifyReply, data: T): void {
    reply.status(HttpStatus.CREATED).send(data)
  }

  static sendPaginated<T>(
    reply: FastifyReply,
    data: T[],
    pagination: Pagination,
    additionalMeta?: Record<string, unknown>,
  ): void {
    reply
      .status(HttpStatus.OK)
      .send(this.paginated(data, pagination, additionalMeta))
  }

  static sendNoContent(reply: FastifyReply): void {
    reply.status(HttpStatus.NO_CONTENT).send()
  }

  static sendError(
    reply: FastifyReply,
    statusCode: number,
    message: string,
    details?: unknown,
  ): void {
    reply.status(statusCode).send(this.error(message, statusCode, details))
  }

  static sendBadRequest(
    reply: FastifyReply,
    message: string,
    details?: unknown,
  ): void {
    this.sendError(reply, HttpStatus.BAD_REQUEST, message, details)
  }

  static sendNotFound(
    reply: FastifyReply,
    message: string = 'Resource not found',
    details?: unknown,
  ): void {
    this.sendError(reply, HttpStatus.NOT_FOUND, message, details)
  }

  static sendUnauthorized(
    reply: FastifyReply,
    message: string = 'Unauthorized',
    details?: unknown,
  ): void {
    this.sendError(reply, HttpStatus.UNAUTHORIZED, message, details)
  }

  static sendForbidden(
    reply: FastifyReply,
    message: string = 'Forbidden',
    details?: unknown,
  ): void {
    this.sendError(reply, HttpStatus.FORBIDDEN, message, details)
  }

  static sendInternalError(
    reply: FastifyReply,
    message: string = 'Internal server error',
    details?: unknown,
  ): void {
    this.sendError(reply, HttpStatus.INTERNAL_SERVER_ERROR, message, details)
  }
}

export const Response = ApiResponseBuilder
