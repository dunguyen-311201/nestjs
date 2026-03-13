import { FastifyInstance } from 'fastify'
import fp from 'fastify-plugin'

import cron from 'node-cron'

export default fp(async (fastify: FastifyInstance) => {
  const { inventoryService } = fastify.container.services

  // Run every 1 minute
  cron.schedule('* * * * *', async () => {
    fastify.log.info('Running stock reservation cleanup job...')
    try {
      await inventoryService.releaseExpiredReservations()
    } catch (error) {
      fastify.log.error({ error }, 'Error in stock reservation cleanup job')
    }
  })

  fastify.log.info('Cron plugin registered')
})
