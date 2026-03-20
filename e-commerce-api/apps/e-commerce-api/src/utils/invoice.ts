import { InvoiceItemData } from '#services'

import { Invoice } from '#types'

export const formatInvoiceItems = (invoice: Invoice): InvoiceItemData[] => {
  const items = invoice.lines.data.map((item) => ({
    productName: item.description ?? '',
    unitPrice: parseFloat(item.pricing?.unit_amount_decimal || '0') / 100,
    quantity: item.quantity ?? 0,
    currency: item.currency,
    total: item.amount,
    productId: item.pricing?.price_details?.product ?? '',
  }))

  return items
}
