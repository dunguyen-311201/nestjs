import { getCategories, getProducts } from '@/lib/data'
import { ProductSearchParams } from '@/lib/types'

import { ProductCardWithCart } from '@/components/ProductCard'
import { CategoryFilter } from '@/components/category-filter'
import { PaginationControls } from '@/components/pagination-controls'
import { SearchInput } from '@/components/search-input'
import { SortSelect } from '@/components/sort-select'

export default async function ProductList({
  searchParams,
}: {
  searchParams: ProductSearchParams
}) {
  const search = searchParams.search ?? undefined
  const orderBy = searchParams.orderBy ?? undefined
  const order = searchParams.order ?? undefined
  const category = searchParams.category ?? undefined
  const page = parseInt(searchParams.page ?? '1', 10)

  const [data, categories] = await Promise.all([
    getProducts({ search, orderBy, order, category, page, limit: 8 }),
    getCategories(),
  ])

  if (data.error) {
    return <div>Error: {data.error}</div>
  }

  const { products, pagination } = data!

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex flex-col gap-6 mb-8">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
          <h1 className="text-3xl font-bold">Products</h1>
          <div className="flex flex-col sm:flex-row gap-4 w-full md:w-auto">
            <SearchInput />
            <SortSelect />
          </div>
        </div>
        <CategoryFilter categories={categories} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-8">
        {products.map((product) => (
          <ProductCardWithCart key={product.id} {...product} />
        ))}
      </div>

      <PaginationControls
        currentPage={pagination.currentPage}
        totalPages={pagination.totalPages}
      />
    </div>
  )
}
