import { FastifyBaseLogger, FastifyReply, FastifyRequest } from 'fastify'
import { vi } from 'vitest'

export const createMockRequest = <T = FastifyRequest>(
  overrides: Partial<FastifyRequest> = {},
): T => {
  return {
    params: {},
    query: {},
    body: {},
    headers: {},
    routerPath: '',
    ip: '127.0.0.1',
    auth: {
      userId: '',
      orgRole: '',
      stripeId: '',
    },
    log: {
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn(),
    },
    ...overrides,
  } as unknown as T
}

export const createMockReply = (): FastifyReply => {
  const reply = {
    send: vi.fn().mockReturnThis(),
    status: vi.fn().mockReturnThis(),
    code: vi.fn().mockReturnThis(),
    header: vi.fn().mockReturnThis(),
    headers: vi.fn().mockReturnThis(),
    serialize: vi.fn(),
    raw: {
      writeHead: vi.fn(),
      end: vi.fn(),
    },
  } as unknown as FastifyReply

  return reply
}

export const createMockQueryRunner = (
  overrides: Record<string, any> = {},
): Record<string, any> => ({
  connect: vi.fn(),
  startTransaction: vi.fn(),
  commitTransaction: vi.fn(),
  rollbackTransaction: vi.fn(),
  release: vi.fn(),
  manager: {
    save: vi
      .fn()
      .mockImplementation((entity, data) => Promise.resolve(data || entity)),
    create: vi.fn().mockImplementation((_cls, data) => ({ ...data })),
    findOne: vi.fn(),
    find: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
    delete: vi.fn(),
    createQueryBuilder: vi.fn(() => ({
      setLock: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      andWhere: vi.fn().mockReturnThis(),
      leftJoinAndSelect: vi.fn().mockReturnThis(),
      getOne: vi.fn(),
      getMany: vi.fn().mockResolvedValue([]),
    })),
  },
  ...overrides,
})

export const createMockRepository = (
  overrides: Record<string, any> = {},
): Record<string, any> => ({
  findOne: vi.fn(),
  findOneBy: vi.fn(),
  find: vi.fn(),
  findAndCount: vi.fn(),
  save: vi.fn(),
  create: vi.fn(),
  delete: vi.fn(),
  remove: vi.fn(),
  update: vi.fn(),
  insert: vi.fn(),
  getOne: vi.fn(),
  getCartByUserId: vi.fn(),
  getByStripeId: vi.fn(), // Added for UserRepository
  createOrder: vi.fn(), // Added for OrderRepository
  findOrdersByUserId: vi.fn(), // OrderRepository
  findOrders: vi.fn(), // OrderRepository
  getProducts: vi.fn(), // ProductRepository
  getById: vi.fn(), // ProductRepository
  getAdminMetrics: vi.fn(), // ProductRepository
  createOrderFromCart: vi.fn(), // Likely needed in future given patterns
  createQueryBuilder: vi.fn(() => ({
    select: vi.fn().mockReturnThis(),
    addSelect: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    andWhere: vi.fn().mockReturnThis(),
    leftJoinAndSelect: vi.fn().mockReturnThis(),
    skip: vi.fn().mockReturnThis(),
    take: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    getManyAndCount: vi.fn(),
    getOne: vi.fn(),
    getRawOne: vi.fn(),
    execute: vi.fn(),
    cache: vi.fn().mockReturnThis(),
  })),
  manager: {
    save: vi.fn(),
    remove: vi.fn(),
    findOne: vi.fn(),
    find: vi.fn(), // Added find
    connection: {
      createQueryRunner: vi.fn(),
    },
  },
  ...overrides,
})

export const loggerMock = {
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
  debug: vi.fn(),
  trace: vi.fn(),
  fatal: vi.fn(),
  child: vi.fn().mockReturnThis(),
} as unknown as FastifyBaseLogger

export const createMockPaymentGateway = (
  overrides: Record<string, any> = {},
): Record<string, any> => ({
  createInvoice: vi.fn(),
  getInvoice: vi.fn(),
  getPaymentDetails: vi.fn(),
  getInvoiceLineItems: vi.fn(),
  createInvoiceItem: vi.fn(),
  finalizeInvoice: vi.fn(),
  getInvoicePayment: vi.fn(),
  getOpenedInvoiceByUser: vi.fn(),
  createProduct: vi.fn(),
  createCustomer: vi.fn(),
  getPaymentIntents: vi.fn(),
  createPaymentIntents: vi.fn(),
  findOrCreateCustomer: vi.fn(),
  getPaymentIntent: vi.fn(),
  getCharge: vi.fn(),
  processPayment: vi.fn(),
  ...overrides,
})

export const createMockMailProvider = (
  overrides: Record<string, any> = {},
): { send: (...args: any[]) => any } & Record<string, any> => ({
  send: vi.fn(),
  ...overrides,
})

export const createMockInventoryService = (
  overrides: Record<string, any> = {},
): Record<string, any> => ({
  checkAvailability: vi.fn(),
  reserveStock: vi.fn(),
  commitStock: vi.fn(),
  releaseStock: vi.fn(),
  releaseExpiredReservations: vi.fn(),
  ...overrides,
})
