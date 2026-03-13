import { FastifyBaseLogger } from 'fastify'

import type {
  TCartItemRepository,
  TCartRepository,
  TProductRepository,
} from '#repositories'

import { BadRequestError, CartPayLoad, NotFoundError } from '#types'

import { Cart, CartItem } from '#entities'

import { ICartService } from './type'

export class CartService implements ICartService {
  constructor(
    private cartRepository: TCartRepository,
    private cartItemRepository: TCartItemRepository,
    private productRepository: TProductRepository,
    private logger: FastifyBaseLogger,
  ) {}

  async createCart(userId: string): Promise<Cart> {
    this.logger.info({ userId }, 'Creating new cart for user')
    try {
      const newCart = this.cartRepository.create({
        user: { id: userId },
        items: [],
        status: 'active',
      })
      await this.cartRepository.insert(newCart)
      this.logger.info(
        { userId, cartId: newCart.id },
        'Cart created successfully',
      )
      return newCart
    } catch (error) {
      this.logger.error({ userId, error }, 'Error creating cart')
      throw error
    }
  }

  async addProductToCart({
    productId,
    userId,
    quantity,
  }: CartPayLoad): Promise<CartItem> {
    this.logger.info({ userId, productId, quantity }, 'Adding product to cart')
    const cart = await this.getCartByUserId(userId)

    const queryRunner =
      this.cartRepository.manager.connection.createQueryRunner()

    const { id: cartId } = cart

    const product = await this.productRepository.getById(productId)

    if (!product || product.status !== 'published') {
      this.logger.error(
        { productId, userId, status: product?.status },
        'Product not found or not published',
      )
      throw new NotFoundError(`Product ${productId} not found or not available`)
    }
    if (product.stock < quantity) {
      this.logger.error(
        { productId, userId, requested: quantity, available: product.stock },
        'Insufficient stock',
      )
      throw new BadRequestError(`Insufficient stock for Product ${productId}`)
    }

    await queryRunner.startTransaction()
    this.logger.debug(
      { userId, productId, cartId },
      'Transaction started for add to cart',
    )

    try {
      const manager = queryRunner.manager

      let cartItem = await manager.findOne(CartItem, {
        where: { cartId, product: { id: productId } },
        relations: { product: true },
      })

      if (!cartItem || quantity > 0) {
        cartItem = await manager.save(CartItem, {
          ...cartItem,
          product,
          quantity,
          cartId,
        })
        this.logger.debug(
          { userId, productId, quantity, cartId },
          'Cart item saved with quantity',
        )
      } else {
        await manager.remove(cartItem)
      }

      await queryRunner.commitTransaction()
      this.logger.info(
        { userId, productId, cartId },
        'Product added to cart successfully',
      )
      return cartItem
    } catch (error) {
      this.logger.error(
        { userId, productId, error },
        'Error adding product to cart',
      )
      await queryRunner.rollbackTransaction()
      throw error
    } finally {
      await queryRunner.release()
    }
  }

  async getCartByUserId(userId: string): Promise<Cart> {
    this.logger.debug({ userId }, 'Fetching cart for user')
    let cart = await this.cartRepository
      .createQueryBuilder('cart')
      .leftJoinAndSelect('cart.items', 'item')
      .leftJoinAndSelect('item.product', 'product')
      .where('cart.user_id = :userId', { userId })
      .getOne()

    if (!cart) {
      this.logger.debug({ userId }, 'Cart not found, creating new cart')
      cart = await this.createCart(userId)
    }
    this.logger.debug(
      { userId, cartId: cart.id, itemCount: cart.items?.length || 0 },
      'Cart fetched successfully',
    )
    return cart
  }

  async removeProductFromCart(
    itemId: number,
    userId: string,
  ): Promise<boolean> {
    this.logger.info({ userId, itemId }, 'Removing product from cart')
    try {
      await this.deleteCartItem(itemId, userId)
      return true
    } catch (error) {
      if (error instanceof NotFoundError) return false
      throw error
    }
  }

  async clearCart(userId: string): Promise<void> {
    this.logger.info({ userId }, 'Clearing cart')
    const cart = await this.getCartByUserId(userId)
    // delete all items in cart
    await this.cartItemRepository.deleteByCartId(cart.id)
    this.logger.info({ userId, cartId: cart.id }, 'Cart cleared successfully')
  }

  async getCartItemByProduct(
    productId: string,
    cartId: number,
  ): Promise<CartItem | null> {
    this.logger.debug({ productId, cartId }, 'Fetching cart item by product')
    return await this.cartItemRepository.findOneBy({
      product: { id: productId },
      cartId,
    })
  }

  async deleteCartItem(cartItemId: number, userId: string): Promise<void> {
    this.logger.info({ cartItemId, userId }, 'Deleting cart item')

    const result = await this.cartItemRepository
      .createQueryBuilder('cartItem')
      .delete()
      .from('cart_items')
      .where('id = :cartItemId', { cartItemId })
      .andWhere('cart_id IN (SELECT id FROM carts WHERE user_id = :userId)', {
        userId,
      })
      .execute()

    if (result.affected === 0) {
      throw new NotFoundError('Item not found or user lacks permission')
    }

    this.logger.info(
      { cartItemId, userId, affected: result.affected },
      'Cart item deleted successfully',
    )
  }

  async updateCartItemQuantity(
    cartItemId: number,
    quantity: number,
    userId: string,
  ): Promise<boolean> {
    this.logger.info(
      { cartItemId, quantity, userId },
      'Updating cart item quantity',
    )
    const result = await this.cartItemRepository
      .createQueryBuilder('cartItem')
      .update({ quantity })
      .where('id = :cartItemId', { cartItemId })
      .andWhere('cart_id IN (SELECT id FROM carts WHERE user_id = :userId)', {
        userId,
      })
      .execute()

    if (result.affected === 0) {
      throw new NotFoundError('Item not found or user lacks permission')
    }

    this.logger.info(
      { cartItemId, quantity, affected: result.affected },
      'Cart item quantity updated successfully',
    )
    return true
  }
}
