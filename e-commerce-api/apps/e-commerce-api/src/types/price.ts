import { IProduct } from './product'

export interface Price {
  id: string
  object: 'price'
  active: boolean
  created: number
  currency: string
  deleted?: void
  nickname: string | null
  product: string | IProduct | DeletedProduct
  unit_amount: number | null
}

/**
 * Represents a deleted product in the system
 */
export interface DeletedProduct {
  id: string
  object: 'product'
  deleted: true
}

export interface InvoiceLineItemPricing {
  price_details?: PriceDetails

  /**
   * The type of the pricing details.
   */
  type: 'price_details'

  /**
   * The unit amount (in the `currency` specified) of the item which contains a decimal value with at most 12 decimal places.
   */
  unit_amount_decimal: string | null
}

interface PriceDetails {
  /**
   * The ID of the price this item is associated with.
   */
  price: string | Price

  /**
   * The ID of the product this item is associated with.
   */
  product: string
}
