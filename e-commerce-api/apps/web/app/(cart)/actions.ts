'use server'

import { revalidatePath } from 'next/cache'

import { updateOrderStatus } from '@/lib/orders'
import { OrderStatus } from '@/lib/types'

export async function updateOrderStatusAction(
  orderId: number,
  status: OrderStatus,
) {
  await updateOrderStatus(orderId, status)
  revalidatePath('/admin/orders')
  revalidatePath('/orders')
}
