'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'

export function OrderFilters() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const handleFilterChange = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams)
    if (value) {
      params.set(key, value)
    } else {
      params.delete(key)
    }
    params.set('page', '1') // Reset to first page on filter change
    router.replace(`${pathname}?${params.toString()}`)
  }

  return (
    <div className="flex items-center gap-2">
      <select
        className="h-8 rounded-md border border-input bg-background px-2 text-xs font-medium shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
        value={searchParams.get('status') || ''}
        onChange={(e) => handleFilterChange('status', e.target.value)}
      >
        <option value="">All Statuses</option>
        <option value="pending">Pending</option>
        <option value="processing">Processing</option>
        <option value="shipped">Shipped</option>
        <option value="delivered">Delivered</option>
        <option value="cancelled">Cancelled</option>
        <option value="paid">Paid</option>
      </select>

      <input
        type="date"
        className="h-8 rounded-md border border-input bg-background px-2 text-xs font-medium shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
        value={searchParams.get('date') || ''}
        onChange={(e) => handleFilterChange('date', e.target.value)}
      />
      {(searchParams.get('status') || searchParams.get('date')) && (
        <button
          onClick={() => {
            const params = new URLSearchParams(searchParams)
            params.delete('status')
            params.delete('date')
            params.set('page', '1')
            router.replace(`${pathname}?${params.toString()}`)
          }}
          className="h-8 px-2 text-xs font-medium text-destructive hover:underline"
        >
          Clear
        </button>
      )}
    </div>
  )
}
