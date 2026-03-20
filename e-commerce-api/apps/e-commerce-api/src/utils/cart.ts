import { InvoiceItemData } from '#services'

import { CartItem } from '#entities'

export const formatCartItems = (
  items: CartItem[],
  currency: string,
): InvoiceItemData[] => {
  return items.map(({ product, quantity }) => ({
    productName: product.name,
    unitPrice: product.price,
    quantity: quantity ?? 0,
    currency: currency,
    total: product.price * quantity,
    productId: product.id,
  }))
}
