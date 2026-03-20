import fp from 'fastify-plugin'

import sgMail from '@sendgrid/mail'

import env from '#env'

export default fp(async (fastify) => {
  sgMail.setApiKey(env.mail.apiKey)
  fastify.decorate('sendgrid', sgMail)
})
