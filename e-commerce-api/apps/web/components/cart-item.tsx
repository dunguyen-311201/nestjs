'use client'

import Image from 'next/image'
import { useState } from 'react'

import { CartItem as TCartItem } from '@/lib/types'
import { formatCurrency } from '@/lib/utils'

interface CartItemProps {
  item: TCartItem
  removeFromCart: (cartItemId: string) => void
  updateQuantity: (cartItemId: string, quantity: number) => void
}

export function CartItem({
  item,
  updateQuantity,
  removeFromCart,
}: CartItemProps) {
  const [quantity, setQuantity] = useState(item.quantity)

  const handleDecrease = () => {
    const newQuantity = quantity - 1
    setQuantity(newQuantity)
    updateQuantity(item.id, newQuantity)
  }

  const handleIncrease = () => {
    const newQuantity = quantity + 1
    setQuantity(newQuantity)
    updateQuantity(item.id, newQuantity)
  }

  const isOutOfStock = quantity > item.productStock

  return (
    <div
      key={item.id}
      className="flex items-center gap-4 border-b border-border pb-4"
    >
      <div className="relative h-24 w-24 bg-secondary rounded-md overflow-hidden flex-shrink-0">
        <Image
          src={item.productImage || '/file-text.svg'}
          alt={item.productName}
          fill
          className="object-contain p-2"
        />
      </div>
      <div className="flex-grow gap-1">
        <h3 className="font-semibold text-foreground">{item.productName}</h3>
        <p className="text-muted-foreground text-sm">
          {formatCurrency(item.productPrice)}
        </p>
        <div className="flex items-center gap-4 mt-2">
          <div className="flex items-center border border-input rounded-md">
            <button
              onClick={handleDecrease}
              className="px-3 py-1 hover:bg-accent hover:text-accent-foreground"
            >
              -
            </button>
            <span className="px-3 py-1 border-x border-input">{quantity}</span>
            <button
              onClick={handleIncrease}
              disabled={quantity >= item.productStock}
              className="px-3 py-1 hover:bg-accent hover:text-accent-foreground disabled:opacity-50 disabled:cursor-not-allowed"
            >
              +
            </button>
          </div>
          <button
            onClick={() => removeFromCart(item.id)}
            className="text-destructive text-sm hover:underline"
          >
            Remove
          </button>
        </div>
        {isOutOfStock && (
          <span className="text-destructive text-sm">
            {`Out of stock: ${item.productStock}`}
          </span>
        )}
      </div>

      <div className="text-right font-semibold text-foreground">
        {formatCurrency(item.productPrice * item.quantity)}
      </div>
    </div>
  )
}
