'use client'

import { useAuth } from '@clerk/nextjs'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'

import { API_ROUTES, post } from '@/lib/api'
import { getClientEndpoint } from '@/lib/client'
import { PaymentIntent } from '@/lib/types'
import { debounce, formatCurrency } from '@/lib/utils'

import { useCart } from '@/context/CartContext'

import Loading, { LoadingIndicator, LoadingRef } from '@/components/Loading'
import { CartItem } from '@/components/cart-item'

export default function CartPage() {
  const { cart, removeFromCart, updateQuantity, cartTotal, status } = useCart()
  const [localCart, setLocalCart] = useState(cart)
  const loadingRef = useRef<LoadingRef | null>(null)
  const router = useRouter()
  const [isPending, setIsPending] = useState(false)

  const { isLoaded } = useAuth()

  useEffect(() => {
    setLocalCart(cart)
  }, [cart])

  const handleCheckout = async (e: React.MouseEvent<HTMLButtonElement>) => {
    try {
      setIsPending(true)
      if (status === 'out_of_stock') {
        e.preventDefault()
        return
      }

      const { clientSecret, orderId } = await post<PaymentIntent>(
        getClientEndpoint(API_ROUTES.CHECKOUT.CREATE),
        { currency: 'usd' },
      )

      router.push(`/checkout?clientSecret=${clientSecret}&orderId=${orderId}`)
    } catch (error) {
      setIsPending(false)
      toast.error(
        error instanceof Error
          ? error.message
          : 'Failed to checkout. Please try again later.',
      )
    }
  }

  const handleUpdateQuantity = debounce(
    (itemId: string, newQuantity: number) => {
      if (newQuantity <= 0) {
        handleRemoveFromCart(itemId)
        return
      }
      updateQuantity(itemId, newQuantity)
    },
    500,
  )

  const handleRemoveFromCart = (itemId: string) => {
    setLocalCart((prevCart) => prevCart.filter((item) => item.id !== itemId))
    removeFromCart(itemId)
  }

  if (!isLoaded) {
    return <LoadingIndicator loading fullScreen />
  }

  if (localCart.length === 0) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-16 text-center">
        <h1 className="text-3xl font-bold mb-4 text-foreground">
          Your cart is empty
        </h1>
        <p className="text-muted-foreground mb-8">
          Add some items to get started!
        </p>
        <Link
          href="/products"
          className="bg-primary text-primary-foreground px-6 py-3 rounded-md hover:bg-primary/90"
        >
          Continue Shopping
        </Link>
      </div>
    )
  }

  return (
    <Loading ref={loadingRef}>
      <main className="max-w-7xl mx-auto px-4 py-12">
        <h1 className="text-3xl font-bold mb-8 text-foreground">
          Shopping Cart
        </h1>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
          <div className="lg:col-span-2 space-y-4">
            {localCart.map((item) => (
              <CartItem
                key={item.id}
                item={item}
                updateQuantity={handleUpdateQuantity}
                removeFromCart={handleRemoveFromCart}
              />
            ))}
          </div>
          <div className="bg-card p-6 rounded-lg h-fit border border-border">
            <h2 className="text-xl font-bold mb-4 text-foreground">
              Order Summary
            </h2>
            <div className="space-y-2 mb-4 text-sm text-muted-foreground">
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span className="text-foreground">
                  {formatCurrency(cartTotal)}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Shipping</span>
                <span className="text-green-600">Free</span>
              </div>
            </div>
            <div className="border-t border-border pt-4 flex justify-between font-bold text-lg mb-6 text-foreground">
              <span>Total</span>
              <span>{formatCurrency(cartTotal)}</span>
            </div>
            <button
              aria-disabled={status === 'out_of_stock'}
              onClick={handleCheckout}
              className={`w-full block text-center bg-primary text-primary-foreground py-3 rounded-md hover:bg-primary/90 transition-colors ${status === 'out_of_stock' ? 'opacity-50 cursor-not-allowed' : ''} ${isPending ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {isPending ? 'Processing...' : 'Proceed to Checkout'}
            </button>
          </div>
        </div>
      </main>
    </Loading>
  )
}
