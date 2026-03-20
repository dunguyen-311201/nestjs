import { Plus } from 'lucide-react'
import Link from 'next/link'

import { fetchCategories } from '@/lib/category'

export const dynamic = 'force-dynamic'

export default async function AdminCategoriesPage() {
  const categories = await fetchCategories()

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Categories</h1>
        <Link
          href="/admin/categories/new"
          className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-md hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" /> Add Category
        </Link>
      </div>

      <div className="rounded-md border bg-card">
        <div className="relative w-full overflow-auto">
          <table className="w-full caption-bottom text-sm">
            <thead className="[&_tr]:border-b">
              <tr className="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted">
                <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground w-[200px]">
                  ID
                </th>
                <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">
                  Name
                </th>
                <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">
                  Created At
                </th>
              </tr>
            </thead>
            <tbody className="[&_tr:last-child]:border-0">
              {categories.length === 0 ? (
                <tr>
                  <td
                    colSpan={3}
                    className="p-4 text-center text-muted-foreground"
                  >
                    No categories found.
                  </td>
                </tr>
              ) : (
                categories.map((category) => (
                  <tr
                    key={category.id}
                    className="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted"
                  >
                    <td className="p-4 align-middle font-mono text-xs">
                      {category.id}
                    </td>
                    <td className="p-4 align-middle font-medium">
                      {category.name}
                    </td>
                    <td className="p-4 align-middle text-muted-foreground">
                      {category.createdAt
                        ? new Date(category.createdAt).toLocaleDateString()
                        : '-'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
