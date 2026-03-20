'use server'

import { auth } from '@clerk/nextjs/server'

import { getCarts } from '@/lib/cart'
import { CartItem } from '@/lib/types'

import { CartProvider } from '@/context/CartContext'

export default async function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const { isAuthenticated, sessionClaims } = await auth()

  const isAdmin = sessionClaims?.org_role === 'org:admin'

  let cart: CartItem[] = []
  if (isAuthenticated && !isAdmin) {
    try {
      cart = await getCarts()
    } catch (error) {
      console.error('Failed to fetch cart on server:', error)
      // Handle error gracefully, maybe show a toast on the client
    }
  }

  return <CartProvider initialCart={cart}>{children}</CartProvider>
}
