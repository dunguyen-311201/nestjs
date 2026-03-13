'use client'

import { useState } from 'react'

import { Product } from '@/lib/types'

import { useCart } from '@/context/CartContext'

export default function AddToCartButton({ product }: { product: Product }) {
  const { addToCart } = useCart()
  const [quantity, setQuantity] = useState(1)

  const handleAddToCart = () => {
    addToCart(product, quantity)
  }

  return (
    <div className="flex items-center space-x-4">
      <input
        type="number"
        min="1"
        value={quantity}
        onChange={(e) => setQuantity(Number(e.target.value))}
        className="w-20 p-2 border rounded-md text-center"
      />
      <button
        onClick={handleAddToCart}
        className="flex-1 bg-primary text-primary-foreground py-4 rounded-md font-bold hover:bg-primary/90 transition-colors"
      >
        Add to Cart
      </button>
    </div>
  )
}
