'use client'

import { useAuth, useClerk } from '@clerk/nextjs'

import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'
import { toast } from 'sonner'

import { API_ROUTES, del, post, put } from '@/lib/api'
import { getClientEndpoint } from '@/lib/client'
import { UnauthorizedError } from '@/lib/errors'
import { CartItem, Product } from '@/lib/types'
import { getCartTotal } from '@/lib/utils'

interface CartContextType {
  cart: CartItem[]
  addToCart: (product: Product, quantity: number) => Promise<void>
  removeFromCart: (itemId: string) => Promise<void>
  updateQuantity: (itemId: string, quantity: number) => Promise<void>
  clearCart: () => void
  cartTotal: number
  cartCount: number
  status: 'available' | 'out_of_stock'
}

interface CartAddResponse {
  id: string
}

const CartContext = createContext<CartContextType | undefined>(undefined)

export function CartProvider({
  children,
  initialCart = [],
}: {
  children: React.ReactNode
  initialCart?: CartItem[]
}) {
  const [cart, setCart] = useState<CartItem[]>(initialCart)
  const { isSignedIn, isLoaded } = useAuth()

  const { signOut, redirectToSignIn } = useClerk()

  const status: 'available' | 'out_of_stock' = useMemo(() => {
    const outOfStockItem = cart.find(
      (item) => item.quantity > item.productStock,
    )
    return outOfStockItem ? 'out_of_stock' : 'available'
  }, [cart])

  useEffect(() => {
    return () => {
      if (!isSignedIn && isLoaded) {
        clearCart()
      }
    }
  }, [isSignedIn, isLoaded])

  const handleApiError = (error: unknown) => {
    if (error instanceof UnauthorizedError) {
      signOut()
    } else {
      console.error(error)
      const message =
        error instanceof Error ? error.message : 'An error occurred'
      toast.error(message)
    }
  }

  const addToCart = async (product: Product, quantity: number = 1) => {
    try {
      if (!isSignedIn) {
        redirectToSignIn({ redirectUrl: '/products' })
      }

      const response = await post<CartAddResponse>(
        getClientEndpoint(API_ROUTES.CART.ADD_ITEM),
        {
          productId: product.id,
          quantity,
        },
      )
      setCart((prevCart) => {
        const existingItem = prevCart.find(
          (item) => item.productId === product.id,
        )
        if (existingItem) {
          return prevCart.map((item) =>
            item.productId === product.id
              ? { ...item, quantity: quantity }
              : item,
          )
        }

        return [
          ...prevCart,
          {
            id: response.id,
            productId: product.id,
            productName: product.name,
            productImage: product.images[0]!,
            productPrice: product.price,
            productStock: product.stock,
            quantity,
          },
        ]
      })
      toast.success(`${product.name} added to cart`)
    } catch (error) {
      handleApiError(error)
    }
  }

  const removeFromCart = async (cartItemId: string) => {
    try {
      await del(getClientEndpoint(API_ROUTES.CART.DELETE_ITEM(cartItemId)))
      setCart((prevCart) => prevCart.filter((item) => item.id !== cartItemId))
      toast.success('Item removed from cart')
    } catch (error) {
      handleApiError(error)
    }
  }

  const updateQuantity = async (cartItemId: string, quantity: number) => {
    if (quantity <= 0) {
      await removeFromCart(cartItemId)
      return
    }
    try {
      await put(getClientEndpoint(API_ROUTES.CART.UPDATE_ITEM(cartItemId)), {
        quantity,
      })
      setCart((prevCart) =>
        prevCart.map((item) =>
          item.id === cartItemId ? { ...item, quantity } : item,
        ),
      )
      toast.success('Cart updated')
    } catch (error) {
      handleApiError(error)
    }
  }

  const clearCart = () => setCart([])

  const cartTotal = getCartTotal(cart)

  const cartCount = cart.reduce((count, item) => count + item.quantity, 0)

  return (
    <CartContext.Provider
      value={{
        cart,
        addToCart,
        removeFromCart,
        updateQuantity,
        clearCart,
        cartTotal,
        cartCount,
        status,
      }}
    >
      {children}
    </CartContext.Provider>
  )
}

export function useCart() {
  const context = useContext(CartContext)
  if (context === undefined) {
    throw new Error('useCart must be used within a CartProvider')
  }
  return context
}
