import { FastifyReply, FastifyRequest } from 'fastify'

import { HttpStatus } from '#types'

export const validateRequest = async (
  request: FastifyRequest,
  reply: FastifyReply,
) => {
  if (request.validationError) {
    return reply
      .status(HttpStatus.BAD_REQUEST)
      .send({ message: request.validationError.message })
  }
}
