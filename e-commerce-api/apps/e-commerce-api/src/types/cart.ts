/**
 * Payload for adding or updating cart items
 */
export type CartPayLoad = {
  productId: string
  userId: string
  quantity: number
}
