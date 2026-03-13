'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'

interface ProductStatusFilterProps {
  totalActive?: number
  totalDeleted?: number
  totalAll?: number
}

export function ProductStatusFilter({
  totalActive,
  totalDeleted,
  totalAll,
}: ProductStatusFilterProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const currentStatus = searchParams.get('status') || 'published'

  const handleFilterChange = (status: string) => {
    const params = new URLSearchParams(searchParams)
    if (status === 'published') {
      params.delete('status') // Default is published
    } else {
      params.set('status', status)
    }
    params.set('page', '1') // Reset to page 1
    router.replace(`${pathname}?${params.toString()}`)
  }

  const filters = [
    {
      id: 'published',
      label: 'Published',
      description: 'Currently on sale',
      count: totalActive, // Mapped from active for now, or update props
      color: 'bg-green-500',
    },
    {
      id: 'draft',
      label: 'Draft',
      description: 'Not yet visible',
      count: 0, // Need prop support
      color: 'bg-yellow-500',
    },
    {
      id: 'archived',
      label: 'Archived',
      description: 'Hidden from store',
      count: 0, // Need prop support
      color: 'bg-gray-500',
    },
    {
      id: 'deleted',
      label: 'Deleted',
      description: 'Soft deleted items',
      count: totalDeleted,
      color: 'bg-red-500',
    },
    {
      id: 'all',
      label: 'All',
      description: 'All products',
      count: totalAll,
      color: 'bg-blue-500',
    },
  ]

  return (
    <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
      {filters.map((filter) => {
        const isActive =
          currentStatus === filter.id ||
          (filter.id === 'published' && !searchParams.get('status')) // Default published?

        return (
          <div
            key={filter.id}
            onClick={() => handleFilterChange(filter.id)}
            className={`
              relative flex flex-col justify-between p-4 rounded-xl border cursor-pointer transition-all hover:shadow-md
              ${isActive ? 'bg-primary/5 border-primary ring-1 ring-primary' : 'bg-card border-border hover:border-primary/50'}
            `}
          >
            <div className="flex justify-between items-start mb-2">
              <div>
                <h3
                  className={`font-semibold ${isActive ? 'text-primary' : 'text-foreground'}`}
                >
                  {filter.label}
                </h3>
                <p className="text-xs text-muted-foreground mt-1">
                  {filter.description}
                </p>
              </div>
              <div className={`h-2 w-2 rounded-full ${filter.color}`} />
            </div>
          </div>
        )
      })}
    </div>
  )
}
