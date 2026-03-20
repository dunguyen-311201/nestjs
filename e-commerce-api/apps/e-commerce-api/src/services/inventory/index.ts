import { FastifyBaseLogger } from 'fastify'
import { QueryRunner } from 'typeorm'

import dayjs from 'dayjs'

import { TProductRepository, TStockreservationRepository } from '#repositories'

import {
  BadRequestError,
  StockReservationStatus,
  UnexpectedError,
} from '#types'

import { Product, StockReservation } from '#entities'

import { IInventoryService } from './type'

export class InventoryService implements IInventoryService {
  constructor(
    private productRepository: TProductRepository,
    private stockReservationRepository: TStockreservationRepository,
    private logger: FastifyBaseLogger,
  ) {}

  async checkAvailability(
    items: { productId: string; quantity: number }[],
  ): Promise<void> {
    this.logger.debug({ items }, 'Checking product availability')

    for (const item of items) {
      const product = await this.productRepository.getById(item.productId)

      if (!product) {
        throw new BadRequestError(`Product with ID ${item.productId} not found`)
      }

      if (product.status !== 'published') {
        throw new BadRequestError(`Product ${product.name} is not available`)
      }

      const availableStock = product.stock - product.reservedStock
      if (item.quantity > availableStock) {
        throw new BadRequestError(`Product ${product.name} is out of stock`)
      }
    }
  }

  async reserveStock(
    queryRunner: QueryRunner,
    items: { productId: string; quantity: number }[],
    invoiceId: string,
    cartId: number,
  ): Promise<void> {
    this.logger.debug(
      { invoiceId, cartId, itemCount: items.length },
      'Reserving stock',
    )

    const productIds = items.map((item) => item.productId)
    const products = await queryRunner.manager
      .createQueryBuilder(Product, 'product')
      .setLock('pessimistic_write')
      .where('product.id IN (:...ids)', { ids: productIds })
      .getMany()

    const productMap = new Map(products.map((p) => [p.id, p]))
    const reservations: StockReservation[] = []

    for (const item of items) {
      const product = productMap.get(item.productId)
      if (!product) {
        throw new UnexpectedError(
          `Product ${item.productId} not found during reservation`,
        )
      }

      const availableStock = product.stock - product.reservedStock
      if (item.quantity > availableStock) {
        throw new BadRequestError(
          `Insufficient stock for product ${product.name}`,
        )
      }

      product.reservedStock += item.quantity

      const reservation = queryRunner.manager.create(StockReservation, {
        cartId,
        productId: product.id,
        quantity: item.quantity,
        status: StockReservationStatus.RESERVED,
        expiresAt: dayjs().add(15, 'minute').toDate(),
        invoiceId,
      })

      reservations.push(reservation)
    }

    await queryRunner.manager.save(products)
    await queryRunner.manager.save(reservations)

    this.logger.info({ invoiceId }, 'Stock reserved successfully')
  }

  async commitStock(
    queryRunner: QueryRunner,
    invoiceId: string,
  ): Promise<void> {
    this.logger.debug({ invoiceId }, 'Committing stock reservations')

    const reservations = await queryRunner.manager
      .createQueryBuilder(StockReservation, 'sr')
      .setLock('pessimistic_write')
      .where('sr.invoice_id = :invoiceId', { invoiceId })
      .andWhere('sr.status = :status', {
        status: StockReservationStatus.RESERVED,
      })
      .getMany()

    if (reservations.length === 0) {
      this.logger.warn({ invoiceId }, 'No reserved stock found to commit')
      return
    }

    const productIds = reservations.map((r) => r.productId)
    const products = await queryRunner.manager
      .createQueryBuilder(Product, 'product')
      .setLock('pessimistic_write')
      .where('product.id IN (:...ids)', { ids: productIds })
      .getMany()

    const productMap = new Map(products.map((p) => [p.id, p]))

    for (const reservation of reservations) {
      const product = productMap.get(reservation.productId)
      if (!product) {
        throw new UnexpectedError(
          `Product ${reservation.productId} not found during commit`,
        )
      }

      if (product.stock < reservation.quantity) {
        throw new UnexpectedError(
          `Critical: Insufficient stock to commit for product ${product.name}`,
        )
      }

      product.stock -= reservation.quantity
      product.reservedStock -= reservation.quantity
      reservation.status = StockReservationStatus.CONVERTED
    }

    await queryRunner.manager.save(products)
    await queryRunner.manager.save(reservations)

    this.logger.info({ invoiceId }, 'Stock committed successfully')
  }

  async releaseStock(
    queryRunner: QueryRunner,
    invoiceId: string,
  ): Promise<void> {
    this.logger.debug({ invoiceId }, 'Releasing stock reservations')

    const reservations = await queryRunner.manager
      .createQueryBuilder(StockReservation, 'sr')
      .setLock('pessimistic_write')
      .where('sr.invoice_id = :invoiceId', { invoiceId })
      .andWhere('sr.status = :status', {
        status: StockReservationStatus.RESERVED,
      })
      .getMany()

    if (reservations.length === 0) return

    const productIds = reservations.map((r) => r.productId)
    const products = await queryRunner.manager
      .createQueryBuilder(Product, 'product')
      .setLock('pessimistic_write')
      .where('product.id IN (:...ids)', { ids: productIds })
      .getMany()

    const productMap = new Map(products.map((p) => [p.id, p]))

    for (const reservation of reservations) {
      const product = productMap.get(reservation.productId)
      if (product) {
        product.reservedStock -= reservation.quantity
        if (product.reservedStock < 0) product.reservedStock = 0
      }
      reservation.status = StockReservationStatus.RELEASED
    }

    await queryRunner.manager.save(products)
    await queryRunner.manager.save(reservations)

    this.logger.info({ invoiceId }, 'Stock released successfully')
  }

  async releaseExpiredReservations(): Promise<void> {
    const queryRunner = this.createQueryRunner()
    try {
      await queryRunner.connect()
      await queryRunner.startTransaction()

      const expiredReservations = await queryRunner.manager
        .withRepository(this.stockReservationRepository)
        .createQueryBuilder('sr')
        .setLock('pessimistic_write')
        .where('sr.status = :status', {
          status: StockReservationStatus.RESERVED,
        })
        .andWhere('sr.expires_at <= :now', { now: new Date() })
        .getMany()

      if (expiredReservations.length === 0) {
        await queryRunner.commitTransaction()
        return
      }

      this.logger.info(
        { count: expiredReservations.length },
        'Found expired reservations to release',
      )

      const productIds = [
        ...new Set(expiredReservations.map((r) => r.productId)),
      ]
      const products = await queryRunner.manager
        .createQueryBuilder(Product, 'product')
        .setLock('pessimistic_write')
        .where('product.id IN (:...ids)', { ids: productIds })
        .getMany()

      const productMap = new Map(products.map((p) => [p.id, p]))

      for (const reservation of expiredReservations) {
        const product = productMap.get(reservation.productId)
        if (product) {
          product.reservedStock -= reservation.quantity
          if (product.reservedStock < 0) product.reservedStock = 0
        }
        reservation.status = StockReservationStatus.RELEASED
      }

      await queryRunner.manager.save(products)
      await queryRunner.manager.save(expiredReservations)

      await queryRunner.commitTransaction()
      this.logger.info(
        { count: expiredReservations.length },
        'Expired stock reservations released',
      )
    } catch (error) {
      this.logger.error(
        { error },
        'Failed to release expired stock reservations',
      )
      await queryRunner.rollbackTransaction()
    } finally {
      await queryRunner.release()
    }
  }

  private createQueryRunner() {
    return this.productRepository.manager.connection.createQueryRunner()
  }
}
export * from './type'
