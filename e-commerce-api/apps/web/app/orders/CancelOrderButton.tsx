'use client'

import { useRouter } from 'next/navigation'
import React, { useState } from 'react'
import { toast } from 'sonner'

import { API_ROUTES, post } from '@/lib/api'
import { getClientEndpoint } from '@/lib/client'

function CancelOrderButton({ orderId }: { orderId: number }) {
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const cancelOrder = async () => {
    try {
      setLoading(true)
      const response = await post<{ success: boolean }>(
        getClientEndpoint(API_ROUTES.ORDER.CANCEL(orderId)),
        {
          status: 'cancelled',
        },
      )

      if (response.success) {
        toast.success('Order cancelled successfully')
        router.refresh()
      } else {
        toast.error('Failed to cancel order')
      }
    } catch (error) {
      toast.error((error as Error).message)
    } finally {
      setLoading(false)
    }
  }
  return (
    <button
      onClick={cancelOrder}
      disabled={loading}
      className="bg-destructive text-white px-4 h-8 leading-8 rounded-md hover:bg-destructive/90 disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {loading ? 'Cancelling...' : 'Cancel'}
    </button>
  )
}

export default CancelOrderButton
