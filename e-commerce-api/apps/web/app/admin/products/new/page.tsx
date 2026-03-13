import { fetchCategories } from '@/lib/category'

import { ProductForm } from '@/components/admin/product-form'

export const dynamic = 'force-dynamic'

export default async function NewProductPage() {
  const categories = await fetchCategories()

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold tracking-tight">Add Product</h1>
      <ProductForm categories={categories} />
    </div>
  )
}
