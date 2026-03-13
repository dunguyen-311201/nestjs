import { QueryRunner } from 'typeorm'

export interface IInventoryService {
  /**
   * Checks if multiple products have sufficient stock.
   * @throws BadRequestError if any product is out of stock or not available
   */
  checkAvailability(
    items: { productId: string; quantity: number }[],
  ): Promise<void>

  /**
   * Reserves stock for a set of items.
   * Internal method typically called within a transaction during checkout.
   */
  reserveStock(
    queryRunner: QueryRunner,
    items: { productId: string; quantity: number }[],
    invoiceId: string,
    cartId: number,
  ): Promise<void>

  /**
   * Finalizes the stock reduction after a successful payment.
   * Converts 'RESERVED' status to 'CONVERTED' and decrements actual stock.
   */
  commitStock(queryRunner: QueryRunner, invoiceId: string): Promise<void>

  /**
   * Releases stock reservations, making them available again.
   * Typically called on payment failure or manual cancellation.
   */
  releaseStock(queryRunner: QueryRunner, invoiceId: string): Promise<void>

  /**
   * Background task to release reservations that have exceeded their expiry time.
   */
  releaseExpiredReservations(): Promise<void>
}
