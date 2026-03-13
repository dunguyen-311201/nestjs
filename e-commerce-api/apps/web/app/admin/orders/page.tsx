import Link from 'next/link'

import { getAllOrders } from '@/lib/orders'

import { OrderFilters } from '@/components/admin/order-filters'
import { OrderStatusSelect } from '@/components/admin/order-status-select'
import { PaginationControls } from '@/components/pagination-controls'

interface AdminOrdersPageProps {
  searchParams: Promise<{ page?: string; status?: string; date?: string }>
}

export default async function AdminOrdersPage({
  searchParams,
}: AdminOrdersPageProps) {
  const params = await searchParams
  const page = Number(params.page) || 1
  const response = await getAllOrders(page, 20, params.status, params.date)
  const orders = response.data || []
  const pagination = response.meta.pagination

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Orders</h1>
        <OrderFilters />
      </div>

      <div className="rounded-md border bg-card">
        <div className="relative w-full overflow-auto">
          <table className="w-full caption-bottom text-sm">
            <thead className="[&_tr]:border-b">
              <tr className="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted">
                <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">
                  Order ID
                </th>
                <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">
                  Date
                </th>
                <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">
                  Customer
                </th>
                <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">
                  Total
                </th>
                <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="[&_tr:last-child]:border-0">
              {orders.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="p-4 text-center text-muted-foreground"
                  >
                    No orders found.
                  </td>
                </tr>
              ) : (
                orders.map((order) => (
                  <tr
                    key={order.id}
                    className="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted"
                  >
                    <td className="p-4 align-middle font-medium">
                      <Link
                        href={`/admin/orders/${order.id}`}
                        className="hover:underline cursor-pointer text-blue-600"
                      >
                        #{order.id}
                      </Link>
                    </td>
                    <td className="p-4 align-middle">
                      {new Date(order.date).toLocaleString()}
                    </td>
                    <td className="p-4 align-middle">
                      <div className="flex flex-col">
                        <span>{order.shippingAddress.name}</span>
                        <span className="text-xs text-muted-foreground">
                          {(order.items || []).length} items
                        </span>
                      </div>
                    </td>
                    <td className="p-4 align-middle">${order.total}</td>
                    <td className="p-4 align-middle">
                      <OrderStatusSelect
                        orderId={order.id}
                        currentStatus={order.status}
                      />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {pagination.totalPages > 1 && (
        <PaginationControls
          totalPages={pagination.totalPages}
          currentPage={pagination.currentPage}
        />
      )}
    </div>
  )
}
