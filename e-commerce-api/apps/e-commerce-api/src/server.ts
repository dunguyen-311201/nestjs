import 'dotenv/config'
import 'reflect-metadata'

import { clerkClient, clerkPlugin, getAuth } from '@clerk/fastify'
import cors from '@fastify/cors'
import fastifyHelmet from '@fastify/helmet'
import fastifyRateLimit from '@fastify/rate-limit'
import { JsonSchemaToTsProvider } from '@fastify/type-provider-json-schema-to-ts'
import Fastify from 'fastify'

import { AppDataSource } from '#data-source'

import env from '#env'

import { buildContainer } from '#utils/container'

import cronPlugin from '#plugins/cron.plugin'
import sendgridPlugin from '#plugins/sendgrid.plugin'
import stripePlugin from '#plugins/stripe.plugin'
import swaggerPlugin from '#plugins/swagger.plugin'

import {
  authenticate,
  authorizeAdmin,
  errorHandler,
  requestLogger,
  responseLogger,
} from '#middlewares'

import {
  adminOrderRoutes,
  authRoutes,
  cartRoutes,
  categoryAdminRoutes,
  categoryRoutes,
  checkoutRoutes,
  metricRoutes,
  orderRoutes,
  productAdminRoutes,
  productRoutes,
  userRoutes,
} from '#routes'

const envToLogger = {
  development: {
    transport: {
      target: 'pino-pretty',
      options: {
        translateTime: 'HH:MM:ss Z',
        ignore: 'pid,hostname',
      },
    },
  },
  production: true,
  test: false,
}

const fastify = Fastify({
  logger: envToLogger[env.nodeEnv] ?? true,
}).withTypeProvider<JsonSchemaToTsProvider>()

fastify.decorateRequest('clerk', { getter: () => ({ clerkClient, getAuth }) })
fastify.decorate('clerk', { getter: () => ({ clerkClient, getAuth }) })

// Set error handler before listen so all errors are covered
fastify.setErrorHandler(errorHandler)

// Health check — unauthenticated, excluded from rate limiting and logging
fastify.get('/health', async (_request, reply) => {
  reply.send({ status: 'ok', timestamp: new Date().toISOString() })
})

const start = async () => {
  try {
    // Register plugins sequentially and await each so their decorations
    // (fastify.stripe, fastify.sendgrid, etc.) are available before buildContainer
    await fastify.register(cors, {
      origin: env.client.baseUrl,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
    })
    await fastify.register(clerkPlugin)
    await fastify.register(stripePlugin)
    await fastify.register(sendgridPlugin)
    await fastify.register(swaggerPlugin)
    await fastify.register(fastifyHelmet)
    await fastify.register(fastifyRateLimit, {
      max: 100,
      timeWindow: '1 minute',
    })

    const dataSource = await AppDataSource.initialize()

    if (env.runMigrations) {
      fastify.log.info('Running database migrations...')
      await dataSource.runMigrations()
      fastify.log.info('Database migrations completed')
    }

    buildContainer(fastify, dataSource)

    fastify.decorate('authenticate', { getter: () => authenticate })
    fastify.decorate('authorizeAdmin', { getter: () => authorizeAdmin })

    await fastify.register(cronPlugin)

    await fastify.register(
      (instance, _opts, done) => {
        instance.addHook(
          'onRequest',
          requestLogger({
            logRequestBody: env.nodeEnv === 'development',
            logResponseBody: false,
            logQuery: true,
            logHeaders: false,
            excludePaths: ['/health', '/metrics'],
          }),
        )

        instance.addHook(
          'onSend',
          responseLogger({
            logResponseBody: false,
          }),
        )

        instance.register(authRoutes, { prefix: '/auth' })
        instance.register(userRoutes, { prefix: '/users' })
        instance.register(productRoutes, { prefix: '/products' })
        instance.register(productAdminRoutes, { prefix: '/admin/products' })
        instance.register(categoryRoutes, { prefix: '/categories' })
        instance.register(categoryAdminRoutes, { prefix: '/admin/categories' })
        instance.register(cartRoutes, { prefix: '/cart' })
        instance.register(orderRoutes, { prefix: '/orders' })
        instance.register(adminOrderRoutes, { prefix: '/admin/orders' })
        instance.register(checkoutRoutes, { prefix: '/checkout' })
        instance.register(metricRoutes, { prefix: '/metrics' })

        done()
      },
      { prefix: '/api/v1' },
    )

    await fastify.listen({ port: 8080, host: '0.0.0.0' })

    const shutdown = async (signal: string) => {
      fastify.log.info(`${signal} received: closing HTTP server`)
      await fastify.close()
      fastify.log.info('HTTP server closed')
      await dataSource.destroy()
      fastify.log.info('Database connection closed')
      process.exit(0)
    }

    process.on('SIGTERM', () => shutdown('SIGTERM'))
    process.on('SIGINT', () => shutdown('SIGINT'))
  } catch (error) {
    fastify.log.error(error, 'Failed to start server')
    process.exit(1)
  }
}

start()
