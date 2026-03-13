import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

import { CheckoutItem } from './types'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/* eslint-disable @typescript-eslint/no-explicit-any */
export function debounce<T extends (...args: any[]) => void>(
  func: T,
  delay:
    | number
    | ((prevArgs: Parameters<T>, args: Parameters<T>) => number) = 800,
) {
  let timeout: NodeJS.Timeout
  let prevArgs: Parameters<T> | null = null

  return function (this: ThisParameterType<T>, ...args: Parameters<T>) {
    const time =
      typeof delay === 'function' ? delay(prevArgs ?? args, args) : delay

    if (time > 0) clearTimeout(timeout)

    timeout = setTimeout(() => func.apply(this, args), time)
    prevArgs = args
  } as T
}

export const getCartTotal = (cartItems: CheckoutItem[]) => {
  const cartTotal = cartItems.reduce(
    (total, item) => total + item.productPrice * item.quantity,
    0,
  )

  return cartTotal
}

export const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount)
}
