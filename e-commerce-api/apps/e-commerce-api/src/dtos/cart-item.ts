import { CartItem } from '#entities'

export class CartItemDto {
  id: number
  productName: string
  productId: string
  productImage: string
  productPrice: number
  productStock: number
  quantity: number
  productStatus: string

  constructor({
    product,
    quantity,
    id,
  }: Pick<CartItem, 'id' | 'product' | 'quantity'>) {
    this.id = id

    this.productId = product.id
    this.productImage = product.images[0]!
    this.productName = product.name
    this.productPrice = product.price
    this.productStock = product.stock
    this.productStatus = product.status
    this.quantity = quantity
  }

  toCheckoutItem() {
    return {
      productId: this.productId,
      productName: this.productName,
      productPrice: this.productPrice,
      quantity: this.quantity,
    }
  }
}
