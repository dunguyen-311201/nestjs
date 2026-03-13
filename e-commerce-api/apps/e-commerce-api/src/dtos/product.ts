import { Product } from '#entities'

export class ProductResponseDto {
  category: string
  image: string

  constructor(product: Product) {
    Object.assign(this, product)
    this.category = product.category.name
    this.image = product.images[0]!
  }
}

export const productToObject = (product: Product) => {
  return new ProductResponseDto(product)
}
