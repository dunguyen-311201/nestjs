import { CartPayLoad } from '#types'

import { Cart, CartItem } from '#entities'

export interface ICartService {
  addProductToCart(payload: CartPayLoad): Promise<CartItem>
  removeProductFromCart(itemId: number, userId: string): Promise<boolean>
  getCartByUserId(userId: string): Promise<Cart>
  createCart(userId: string): Promise<Cart>
  clearCart(userId: string): Promise<void>
  getCartItemByProduct(
    productId: string,
    cartId: number,
  ): Promise<CartItem | null>
  deleteCartItem(cartItemId: number, userId: string): Promise<void>
  updateCartItemQuantity(
    cartItemId: number,
    quantity: number,
    userId: string,
  ): Promise<boolean>
}
