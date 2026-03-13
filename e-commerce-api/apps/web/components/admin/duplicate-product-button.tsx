'use client'

import { Copy } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { toast } from 'sonner'

import { API_ROUTES, post } from '@/lib/api'
import { getClientEndpoint } from '@/lib/client'
import { Product } from '@/lib/types'

interface DuplicateProductButtonProps {
  product: Product
}

export function DuplicateProductButton({
  product,
}: DuplicateProductButtonProps) {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)

  const handleDuplicate = async () => {
    if (isLoading) return

    try {
      setIsLoading(true)

      // Create a new product with duplicated data
      await post(getClientEndpoint(API_ROUTES.PRODUCT.CREATE), {
        name: `${product.name} (Copy)`,
        description: product.description,
        price: product.price,
        stock: product.stock,
        category: product.category,
        images: product.images || [],
      })

      toast.success('Product duplicated successfully')
      router.refresh()
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to duplicate product'
      toast.error(message)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <button
      onClick={handleDuplicate}
      disabled={isLoading}
      className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-input bg-background hover:bg-accent hover:text-accent-foreground disabled:opacity-50 disabled:cursor-not-allowed"
      title="Duplicate product"
    >
      <Copy className={`h-4 w-4 ${isLoading ? 'animate-pulse' : ''}`} />
    </button>
  )
}
