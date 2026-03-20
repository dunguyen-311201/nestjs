import { ProductSearchParams } from '@/lib/types'

import ProductList from './product-list'

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<ProductSearchParams>
}) {
  const params = await searchParams
  return <ProductList searchParams={params} />
}
