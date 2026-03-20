'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'

import { API_ROUTES, post } from '@/lib/api'
import { getClientEndpoint } from '@/lib/client'
import {
  CategoryFormData,
  CategoryFormInput,
  categorySchema,
} from '@/lib/schema'
import { Category } from '@/lib/types'

interface CategoryFormProps {
  initialData?: Category
}

export function CategoryForm({ initialData }: CategoryFormProps) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CategoryFormInput>({
    resolver: zodResolver(categorySchema),
    defaultValues: initialData || {
      name: '',
    },
  })

  const onSubmit = async (data: CategoryFormData) => {
    setLoading(true)
    setError(null)
    try {
      const newCategory = await post(
        getClientEndpoint(API_ROUTES.CATEGORY.CREATE),
        data,
      )

      if (!newCategory) {
        throw new Error('Something went wrong')
      }

      router.push('/admin/categories')
      router.refresh()
      toast.success('Category created successfully.')
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message)
      } else {
        setError('An unexpected error occurred')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="space-y-4 bg-card p-6 rounded-lg border max-w-xl"
    >
      <div className="space-y-2">
        <label htmlFor="name" className="text-sm font-medium">
          Category Name
        </label>
        <input
          id="name"
          {...register('name')}
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          placeholder="e.g. Electronics"
        />
        {errors.name && (
          <p className="text-sm text-destructive">{errors.name.message}</p>
        )}
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex justify-end gap-4">
        <button
          type="button"
          onClick={() => router.back()}
          className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-10 px-4 py-2"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={loading}
          className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2"
        >
          {loading ? 'Saving...' : 'Save Category'}
        </button>
      </div>
    </form>
  )
}
