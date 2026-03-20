import Image from 'next/image'
import Link from 'next/link'

import { getUserOrders } from '@/lib/orders'

import { PaginationControls } from '@/components/pagination-controls'

import CancelOrderButton from './CancelOrderButton'

interface OrdersPageProps {
  searchParams: Promise<{ page?: string }>
}

export default async function OrdersPage({ searchParams }: OrdersPageProps) {
  const params = await searchParams
  const page = Number(params.page) || 1
  const response = await getUserOrders(page, 10)
  const orders = response.data || []
  const pagination = response.meta.pagination

  if (orders.length === 0 && page === 1) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center">
        <h1 className="text-3xl font-bold mb-4 text-foreground">
          No orders found
        </h1>
        <p className="text-muted-foreground mb-8">
          You haven&apos;t placed any orders yet.
        </p>
        <Link
          href="/"
          className="bg-primary text-primary-foreground px-6 py-3 rounded-md hover:bg-primary/90"
        >
          Start Shopping
        </Link>
      </div>
    )
  }

  return (
    <main className="max-w-4xl mx-auto px-4 py-12">
      <h1 className="text-3xl font-bold mb-8 text-foreground">Order History</h1>
      <div className="space-y-6">
        {orders.map((order) => (
          <div
            key={order.id}
            className="border bg-card rounded-lg overflow-hidden shadow-sm"
          >
            <div className="bg-muted/50 p-4 flex flex-wrap items-center justify-between gap-4 text-sm">
              <div className="flex gap-8">
                <div>
                  <p className="font-medium text-muted-foreground">
                    Order Placed
                  </p>
                  <p className="text-foreground">
                    {new Date(order.date).toLocaleDateString()}
                  </p>
                </div>
                <div>
                  <p className="font-medium text-muted-foreground">Total</p>
                  <p className="text-foreground">${order.total}</p>
                </div>
                <div>
                  <p className="font-medium text-muted-foreground">Ship To</p>
                  <p className="text-foreground">
                    {order.shippingAddress.name}
                  </p>
                </div>
              </div>
              <div className="flex flex-col items-end">
                <p className="font-medium text-muted-foreground">
                  Order # {order.id}
                </p>
                <span
                  className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                    order.status === 'delivered'
                      ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                      : order.status === 'cancelled'
                        ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
                        : 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400'
                  }`}
                >
                  {order.status}
                </span>
              </div>
            </div>
            <div className="p-4 space-y-4">
              {order.items.map((item) => (
                <div key={item.productId} className="flex items-center gap-4">
                  <div className="relative h-20 w-20 bg-secondary rounded-md overflow-hidden flex-shrink-0">
                    <Image
                      src={item.image}
                      alt={item.name}
                      fill
                      className="object-contain p-2"
                    />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-foreground">
                      {item.name}
                    </h3>
                    <p className="text-muted-foreground text-sm">
                      Quantity: {item.quantity}
                    </p>
                    <p className="text-muted-foreground text-sm">
                      ${item.price} each
                    </p>
                  </div>
                </div>
              ))}
            </div>
            {order.status === 'pending' && (
              <div className="flex gap-3 justify-end p-2">
                <Link
                  href={`/checkout?clientSecret=${order.paymentSecret}&orderId=${order.id}`}
                  className="bg-primary text-primary-foreground px-4 h-8 leading-8 rounded-md hover:bg-primary/90"
                >
                  Pay Now
                </Link>
                <CancelOrderButton orderId={order.id} />
              </div>
            )}
          </div>
        ))}
      </div>

      {pagination.totalPages > 1 && (
        <PaginationControls
          totalPages={pagination.totalPages}
          currentPage={pagination.currentPage}
        />
      )}
    </main>
  )
}
