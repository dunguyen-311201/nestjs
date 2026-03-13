import Link from 'next/link'

import { getOrder } from '@/lib/orders'
import { formatCurrency } from '@/lib/utils'

import CheckoutForm from './CheckoutForm'
import Provider from './Provider'

export default async function CheckoutPage({
  searchParams,
}: {
  searchParams: Promise<{ clientSecret: string; orderId: number }>
}) {
  const { clientSecret, orderId } = await searchParams

  const order = await getOrder(orderId)

  if (!order) {
    throw new Error('Order not found')
  }

  if (order.status !== 'pending') {
    throw new Error('Order is not pending')
  }

  const items = order.items || []

  if (items.length === 0) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-16 text-center">
        <h1 className="text-3xl font-bold mb-4 text-foreground">
          Your cart is empty
        </h1>
        <Link
          href="/"
          className="bg-primary text-primary-foreground px-6 py-3 rounded-md hover:bg-primary/90"
        >
          Continue Shopping
        </Link>
      </div>
    )
  }

  const total = items.reduce(
    (total, item) => total + item.price * item.quantity,
    0,
  )

  return (
    <main className="max-w-7xl mx-auto px-4 py-12">
      <h1 className="text-3xl font-bold mb-8 text-foreground">Checkout</h1>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
        <div>
          <Provider clientSecret={clientSecret}>
            <CheckoutForm cartTotal={total} />
          </Provider>
        </div>

        <div className="bg-muted p-6 rounded-lg h-fit">
          <h2 className="text-xl font-bold mb-4 text-foreground">
            Order Summary
          </h2>
          <div className="space-y-4 mb-4">
            {items.map((item) => (
              <div
                key={item.productId}
                className="flex justify-between items-center text-sm"
              >
                <span className="text-muted-foreground">
                  {item.name} x {item.quantity}
                </span>
                <span className="font-medium text-foreground">
                  {formatCurrency(item.price * item.quantity)}
                </span>
              </div>
            ))}
          </div>
          <div className="border-t border-border pt-4 flex justify-between font-bold text-lg">
            <span className="text-foreground">Total</span>
            <span className="text-foreground">{formatCurrency(total)}</span>
          </div>
        </div>
      </div>
    </main>
  )
}
