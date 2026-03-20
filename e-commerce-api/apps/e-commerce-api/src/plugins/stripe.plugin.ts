import fp from 'fastify-plugin'

import Stripe from 'stripe'

import env from '#env'

export default fp(async (fastify) => {
  const stripe = new Stripe(env.stripe.secretKey, {
    apiVersion: '2026-02-25.clover',
  })
  fastify.decorate('stripe', stripe)
})
