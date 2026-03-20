'use client'

import { updateOrderStatusAction } from '@/app/(cart)/actions'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'

import { OrderStatus } from '@/lib/types'

interface OrderStatusSelectProps {
  orderId: number
  currentStatus: OrderStatus
}

export function OrderStatusSelect({
  orderId,
  currentStatus,
}: OrderStatusSelectProps) {
  const [isPending, startTransition] = useTransition()
  const [status, setStatus] = useState(currentStatus)

  const handleChange = (newStatus: OrderStatus) => {
    setStatus(newStatus)
    startTransition(async () => {
      try {
        await updateOrderStatusAction(orderId, newStatus)
        toast.success(`Order ${orderId} updated to ${newStatus}`)
      } catch {
        toast.error('Failed to update order status')
        setStatus(status) // Revert on error
      }
    })
  }

  return (
    <select
      className="h-8 rounded-md border border-input bg-background px-2 text-xs font-medium shadow-sm focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
      value={status}
      disabled={isPending}
      onChange={(e) => handleChange(e.target.value as OrderStatus)}
    >
      <option value="pending">Pending</option>
      <option value="processing">Processing</option>
      <option value="shipped">Shipped</option>
      <option value="delivered">Delivered</option>
      <option value="cancelled">Cancelled</option>
      <option value="paid">Paid</option>
    </select>
  )
}
