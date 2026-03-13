import Image from 'next/image'
import { notFound } from 'next/navigation'

import { getProductById } from '@/lib/data'

import AddToCartButton from './AddToCartButton'

interface ProductPageProps {
  params: Promise<{ id: string }>
}

export default async function ProductPage({ params }: ProductPageProps) {
  const { id } = await params
  const product = await getProductById(id)

  if (!product) {
    notFound()
  }

  return (
    <main className="max-w-7xl mx-auto px-4 py-12">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
        <div className="relative bg-secondary rounded-lg overflow-hidden flex items-center justify-center h-[500px]">
          <Image
            src={product.images[0] || '/file-text.svg'}
            alt={product.name}
            fill
            className="object-cover"
          />
        </div>
        <div className="space-y-6">
          <nav className="text-sm text-muted-foreground">
            Home / {product.category} / {product.name}
          </nav>
          <h1 className="text-4xl font-bold text-foreground">{product.name}</h1>
          <p className="text-2xl font-bold text-foreground">${product.price}</p>
          <div className="border-y border-border py-6">
            <h3 className="font-semibold mb-2 text-foreground">Description</h3>
            <p className="text-muted-foreground leading-relaxed">
              {product.description}
            </p>
          </div>
          <AddToCartButton product={product} />
        </div>
      </div>
    </main>
  )
}
