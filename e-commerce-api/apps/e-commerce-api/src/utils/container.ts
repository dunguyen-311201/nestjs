import { clerkClient } from '@clerk/fastify'
import { FastifyInstance } from 'fastify'
import { DataSource } from 'typeorm'

import {
  ClerkIdentityProvider,
  SendGridEmailAdapter,
  StripePaymentAdapter,
} from '#adapters'

import {
  AuthService,
  CartService,
  CategoryService,
  CheckoutService,
  InventoryService,
  InvoiceMail,
  MetricService,
  OrderService,
  ProductService,
  type TServices,
  UserService,
} from '#services'

import {
  CartItemRepository,
  CartRepository,
  CategoryRepository,
  OrderItemRepository,
  OrderRepository,
  ProductRepository,
  StockReservationRepository,
  TRepositories,
  UserRepository,
} from '#repositories'

import {
  AdminOrderController,
  AuthController,
  CartController,
  CategoryController,
  CheckoutController,
  MetricController,
  OrderController,
  ProductController,
  TControllers,
  UserController,
} from '#controllers'

import type { EmailProvider, PaymentGateway } from '#types'

import {
  Cart,
  CartItem,
  Category,
  Order,
  OrderItem,
  Product,
  StockReservation,
  User,
} from '#entities'

/**
 * Build controllers from services
 * Can be used with registry or standalone
 */
export function buildControllers(
  services: ReturnType<typeof buildServices>,
): TControllers {
  return {
    productController: new ProductController(services.productService),
    adminOrderController: new AdminOrderController(services.orderService),
    authController: new AuthController(services.authService),
    cartController: new CartController(services.cartService),
    categoryController: new CategoryController(services.categoryService),
    checkoutController: new CheckoutController(services.checkoutService),
    metricController: new MetricController(services.adminService),
    orderController: new OrderController(services.orderService),
    userController: new UserController(services.userService),
  }
}

export function buildServices(
  repos: ReturnType<typeof buildRepositories>,
  adapters: { paymentGateway: PaymentGateway; emailProvider: EmailProvider },
  fastify: FastifyInstance,
): TServices {
  const {
    cartItemRepository,
    cartRepository,
    categoryRepository,
    orderRepository,
    productRepository,
    userRepository,
  } = repos
  const { emailProvider, paymentGateway } = adapters

  const invoiceMail = new InvoiceMail(emailProvider, fastify.log)

  const inventoryService = new InventoryService(
    productRepository,
    repos.stockReservationRepository,
    fastify.log,
  )

  return {
    productService: new ProductService(
      productRepository,
      categoryRepository,
      paymentGateway,
      fastify.log,
    ),
    userService: new UserService(userRepository, paymentGateway, fastify.log),
    cartService: new CartService(
      cartRepository,
      cartItemRepository,
      productRepository,
      fastify.log,
    ),
    categoryService: new CategoryService(categoryRepository, fastify.log),
    orderService: new OrderService(orderRepository, fastify.log),
    checkoutService: new CheckoutService(
      userRepository,
      orderRepository,
      inventoryService,
      paymentGateway,
      invoiceMail,
      fastify.log,
    ),
    authService: new AuthService(
      userRepository,
      cartRepository,
      paymentGateway,
      emailProvider,
      fastify.log,
      new ClerkIdentityProvider(clerkClient, fastify.log),
    ),
    adminService: new MetricService(productRepository, fastify.log),
    inventoryService,
    invoiceMail,
  }
}

/**
 * Build repositories from DataSource
 * Can be used with registry or standalone
 */
export function buildRepositories(ds: DataSource): TRepositories {
  return {
    productRepository: new ProductRepository(ds.getRepository(Product)),
    userRepository: new UserRepository(ds.getRepository(User)),
    cartRepository: new CartRepository(ds.getRepository(Cart)),
    cartItemRepository: new CartItemRepository(ds.getRepository(CartItem)),
    categoryRepository: new CategoryRepository(ds.getRepository(Category)),
    orderRepository: new OrderRepository(ds.getRepository(Order)),
    orderItemRepository: new OrderItemRepository(ds.getRepository(OrderItem)),
    stockReservationRepository: new StockReservationRepository(
      ds.getRepository(StockReservation),
    ),
  }
}

/**
 * Build adapters from Fastify instance
 * Can be used with registry or standalone
 */
export function buildAdapters(fastify: FastifyInstance) {
  const paymentGateway: PaymentGateway = new StripePaymentAdapter(
    fastify.stripe,
    fastify.log,
  )

  const emailProvider: EmailProvider = new SendGridEmailAdapter(
    fastify.sendgrid,
    fastify.log,
  )

  return { paymentGateway, emailProvider }
}

export function buildContainer(
  fastify: FastifyInstance,
  dataSource: DataSource,
) {
  const repositories = buildRepositories(dataSource)
  const adapters = buildAdapters(fastify)
  const services = buildServices(repositories, adapters, fastify)
  const controllers = buildControllers(services)

  const container = { repositories, services, controllers }
  fastify.decorate('container', { getter: () => container })
  fastify.decorateRequest('container', { getter: () => container })
  return container
}

export type TContainer = ReturnType<typeof buildContainer>
