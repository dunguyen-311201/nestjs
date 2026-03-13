import { notFound } from 'next/navigation'

import { fetchCategories } from '@/lib/category'
import { getProductById } from '@/lib/data'

import { ProductForm } from '@/components/admin/product-form'

export const dynamic = 'force-dynamic'

interface EditProductPageProps {
  params: Promise<{ id: string }>
}

export default async function EditProductPage({
  params,
}: EditProductPageProps) {
  const { id } = await params

  const [product, categories] = await Promise.all([
    getProductById(id),
    fetchCategories(),
  ])

  if (!product) {
    notFound()
  }

  const statusColor = {
    published: 'text-green-600/50',
    draft: 'text-yellow-600/50',
    archived: 'text-gray-600/50',
    deleted: 'text-red-600/50',
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-bold tracking-tight">Edit Product</h1>

        <span
          className={`${statusColor[product.status]} leading-5 text-sm font-bold uppercase`}
        >
          {product.status}
        </span>
      </div>
      <ProductForm initialData={product} categories={categories} />
    </div>
  )
}
