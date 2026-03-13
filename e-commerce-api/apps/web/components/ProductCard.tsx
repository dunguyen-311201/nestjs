'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useState } from 'react'

import { Product } from '@/lib/types'

import { TWithCart, withCart } from '@/context/withCart'

export type ProductCardProps = Product

export default function ProductCard({
  addToCart,
  outStock,
  quantity,
  ...product
}: TWithCart<ProductCardProps>) {
  const [isAdding, setIsAdding] = useState(false)

  const handleAddToCart = async () => {
    setIsAdding(true)
    await addToCart(product, quantity)
    setIsAdding(false)
  }

  const { id, name, price, image, description } = product

  return (
    <div className="border border-border rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-shadow bg-card text-card-foreground">
      <Link href={`/products/${id}`}>
        <div className="relative h-48 w-full bg-secondary flex items-center justify-center">
          <Image
            src={image || '/file-text.svg'}
            alt={name}
            fill
            className="object-cover"
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            loading="eager"
          />
        </div>
      </Link>
      <div className="p-4">
        <Link href={`/products/${id}`}>
          <h3 className="font-semibold text-lg hover:text-primary truncate">
            {name}
          </h3>
        </Link>
        <p className="text-muted-foreground text-sm mt-1 line-clamp-2">
          {description}
        </p>
        <div className="mt-4 flex items-center justify-between">
          <span className="font-bold text-xl">${price}</span>
          <button
            onClick={handleAddToCart}
            disabled={outStock || isAdding}
            className="bg-primary text-primary-foreground px-4 py-2 rounded-md text-sm hover:bg-primary/90 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            {isAdding ? 'Adding...' : outStock ? 'Out of Stock' : 'Add to Cart'}
          </button>
        </div>
      </div>
    </div>
  )
}

export const ProductCardWithCart = withCart<ProductCardProps>(ProductCard)
