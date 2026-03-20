import fastifySwagger from '@fastify/swagger'
import fastifySwaggerUI from '@fastify/swagger-ui'
import { FastifyInstance } from 'fastify'
import fp from 'fastify-plugin'

import { env } from '#configs/env'

/**
 * Swagger/OpenAPI plugin for API documentation
 */
export default fp(async function swaggerPlugin(fastify: FastifyInstance) {
  await fastify.register(fastifySwagger, {
    openapi: {
      openapi: '3.0.0',
      info: {
        title: 'E-Commerce API',
        description:
          'RESTful API for E-Commerce platform with product management, cart, orders, and checkout',
        version: '1.0.0',
        contact: {
          name: 'API Support',
          email: env.mail.supportEmail,
        },
      },
      servers: [
        {
          url: 'http://localhost:8080',
          description: 'Development server',
        },
        {
          url: 'https://saundra-unawarded-shirlee.ngrok-free.dev',
          description: 'Production server',
        },
      ],
      tags: [
        { name: 'auth', description: 'Authentication endpoints' },
        { name: 'products', description: 'Product management endpoints' },
        { name: 'categories', description: 'Category endpoints' },
        { name: 'cart', description: 'Shopping cart endpoints' },
        { name: 'cart-items', description: 'Cart item management endpoints' },
        { name: 'orders', description: 'Order management endpoints' },
        { name: 'checkout', description: 'Checkout and payment endpoints' },
        { name: 'admin', description: 'Admin endpoints' },
        { name: 'metrics', description: 'Metrics and analytics endpoints' },
        { name: 'users', description: 'User endpoints' },
      ],
      components: {
        securitySchemes: {
          bearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT',
            description: 'JWT token from Clerk authentication',
          },
        },
      },
    },
  })

  await fastify.register(fastifySwaggerUI, {
    routePrefix: '/docs',

    uiConfig: {
      docExpansion: 'list',
      deepLinking: true,
      displayRequestDuration: true,
      filter: true,
      showExtensions: true,
      showCommonExtensions: true,
      tryItOutEnabled: true,
    },
    uiHooks: {
      onRequest: function (_request, reply, next) {
        // Allow CORS for Swagger UI
        reply.header('Access-Control-Allow-Origin', '*')
        next()
      },
    },
    staticCSP: true,
    transformStaticCSP: (header) => header,
  })
})
