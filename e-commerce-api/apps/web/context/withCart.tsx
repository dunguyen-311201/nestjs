'use client'

import { JSX, useState } from 'react'

import { Product } from '@/lib/types'

import { useCart } from '@/context/CartContext'

type TChild<T> = (props: TWithCart<T>) => React.ReactNode

export const withCart = <T,>(Comp: TChild<T>) => {
  const NewCompoent = (props: Product & T) => {
    const { addToCart, cart } = useCart()

    const { id } = props

    const [quantity, setQuantity] = useState(
      () => cart.find((item) => item.productId === id)?.quantity || 0,
    )

    const handleAddToCart = async (product: Product, quantity: number) => {
      await addToCart(product, quantity + 1)
      setQuantity(quantity + 1)
    }

    return (
      <Comp
        {...(props as JSX.IntrinsicAttributes & T)}
        addToCart={handleAddToCart}
        outStock={quantity >= props.stock}
        quantity={quantity}
      />
    )
  }

  return NewCompoent
}

export type TWithCart<T> = T & {
  addToCart: (product: Product, quantity: number) => Promise<void>
  outStock: boolean
  quantity: number
}
