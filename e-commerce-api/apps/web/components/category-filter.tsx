'use client'

import { Check, ChevronDown, X } from 'lucide-react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'

interface CategoryFilterProps {
  categories: string[]
}

export function CategoryFilter({ categories }: CategoryFilterProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const dropdownRef = useRef<HTMLDivElement>(null)
  const [isOpen, setIsOpen] = useState(false)

  const selectedCategories = searchParams.get('category')?.split(',') || []

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleCategoryToggle = (category: string) => {
    const params = new URLSearchParams(searchParams)
    let currentCategories = params.get('category')?.split(',') || []

    if (category === 'All') {
      params.delete('category')
    } else {
      if (currentCategories.includes(category)) {
        currentCategories = currentCategories.filter((c) => c !== category)
      } else {
        currentCategories.push(category)
      }

      if (currentCategories.length > 0) {
        params.set('category', currentCategories.join(','))
      } else {
        params.delete('category')
      }
    }

    params.set('page', '1')
    router.replace(`${pathname}?${params.toString()}`)
  }

  const clearAll = () => {
    const params = new URLSearchParams(searchParams)
    params.delete('category')
    params.set('page', '1')
    router.replace(`${pathname}?${params.toString()}`)
    setIsOpen(false)
  }

  const displayText =
    selectedCategories.length === 0
      ? 'All Categories'
      : selectedCategories.length === 1
        ? selectedCategories[0]
        : `${selectedCategories.length} selected`

  return (
    <div className="relative w-full md:w-[250px]" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
      >
        <span className="truncate">{displayText}</span>
        <ChevronDown className="h-4 w-4 opacity-50 ml-2 shrink-0" />
      </button>

      {isOpen && (
        <div className="absolute z-50 mt-2 w-full rounded-md border border-input bg-popover shadow-md">
          <div className="max-h-[300px] overflow-y-auto p-1">
            {/* All Categories option */}
            <button
              type="button"
              onClick={() => {
                clearAll()
              }}
              className="flex w-full items-center gap-2 rounded-sm px-3 py-2 text-sm hover:bg-accent transition-colors"
            >
              <div className="h-4 w-4 flex items-center justify-center border rounded-sm border-primary">
                {selectedCategories.length === 0 && (
                  <Check className="h-3 w-3 text-primary" />
                )}
              </div>
              <span>All Categories</span>
            </button>

            {/* Individual categories */}
            {categories
              .filter((cat) => cat !== 'All')
              .map((category) => {
                const isSelected = selectedCategories.includes(category)
                return (
                  <button
                    key={category}
                    type="button"
                    onClick={() => handleCategoryToggle(category)}
                    className="flex w-full items-center gap-2 rounded-sm px-3 py-2 text-sm hover:bg-accent transition-colors"
                  >
                    <div
                      className={`h-4 w-4 flex items-center justify-center border rounded-sm ${
                        isSelected
                          ? 'bg-primary border-primary'
                          : 'border-input'
                      }`}
                    >
                      {isSelected && (
                        <Check className="h-3 w-3 text-primary-foreground" />
                      )}
                    </div>
                    <span>{category}</span>
                  </button>
                )
              })}
          </div>

          {selectedCategories.length > 0 && (
            <div className="border-t border-border p-2">
              <button
                type="button"
                onClick={clearAll}
                className="flex w-full items-center justify-center gap-2 rounded-sm px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
              >
                <X className="h-3 w-3" />
                Clear all
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
