/**
 * Status of stock reservations during checkout process
 * - RESERVED: Stock is temporarily held for a pending order
 * - RELEASED: Reservation was cancelled and stock returned
 * - CONVERTED: Reservation was converted to a confirmed order
 */
export enum StockReservationStatus {
  RESERVED = 'reserved',
  RELEASED = 'released',
  CONVERTED = 'converted',
}
