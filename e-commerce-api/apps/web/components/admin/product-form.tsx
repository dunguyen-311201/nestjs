'use client'

import { faker } from '@faker-js/faker'
import { zodResolver } from '@hookform/resolvers/zod'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'

import { API_ROUTES, post, put } from '@/lib/api'
import { getClientEndpoint } from '@/lib/client'
import { type ProductFormInput, productSchema } from '@/lib/schema'
import { Category, Product } from '@/lib/types'

interface ProductFormProps {
  initialData?: Product
  categories: Category[]
}

faker.seed(10000)

export function ProductForm({ initialData, categories }: ProductFormProps) {
  const router = useRouter()
  const isEditing = !!initialData

  const { id } = initialData || {}

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<ProductFormInput>({
    resolver: zodResolver(productSchema),
    defaultValues: initialData
      ? {
          name: initialData.name,
          description: initialData.description,
          price: initialData.price,
          stock: initialData.stock,
          category: initialData.category,
          image: initialData.images?.[0] || '/file-text.svg',
          isPublic: initialData.status === 'published',
        }
      : {
          image: '/file-text.svg',
          isPublic: false,
        },
  })

  const generateMockData = () => {
    const randomCategory =
      categories.length > 0
        ? categories[Math.floor(Math.random() * categories.length)]?.name ||
          'Electronics'
        : 'Electronics'

    setValue('name', faker.commerce.productName())
    setValue('description', faker.commerce.productDescription())
    setValue('price', faker.commerce.price({ min: 10, max: 500 }))
    setValue('stock', faker.number.int({ min: 20, max: 200 }).toString())
    setValue('category', randomCategory)
    setValue(
      'image',
      faker.image.urlLoremFlickr({
        width: 800,
        height: 600,
        category: 'product',
      }),
    )
    setValue('isPublic', faker.datatype.boolean())
  }

  const onSubmit = async ({ image, isPublic, ...data }: ProductFormInput) => {
    try {
      const payload = {
        ...data,
        status: isPublic ? 'published' : 'draft',
        images: image ? [image] : [],
      }

      if (!id) {
        await post(getClientEndpoint(API_ROUTES.PRODUCT.CREATE), payload)
      } else {
        await put(getClientEndpoint(API_ROUTES.PRODUCT.UPDATE(id)), payload)
      }

      toast.success(
        isEditing
          ? 'Product updated successfully.'
          : 'Product created successfully.',
      )
      router.push('/admin/products')
      router.refresh()
    } catch (error) {
      let message = ''
      if (error instanceof Error) {
        message = error.message
      }

      toast.error(
        message ||
          (isEditing ? 'Failed to update product' : 'Failed to create product'),
      )
    }
  }

  const previewImage = watch('image')

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
      <div className="flex-1 gap-20 flex justify-between">
        <div className="w-1/2 max-w-2xl grid gap-4">
          <div className="grid gap-2">
            <label htmlFor="name" className="text-sm font-medium">
              Name
            </label>
            <input
              id="name"
              {...register('name')}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            />
            {errors.name && (
              <p className="text-sm text-destructive">{errors.name.message}</p>
            )}
          </div>

          <div className="grid gap-2">
            <label htmlFor="description" className="text-sm font-medium">
              Description
            </label>
            <textarea
              id="description"
              {...register('description')}
              className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            />
            {errors.description && (
              <p className="text-sm text-destructive">
                {errors.description.message}
              </p>
            )}
          </div>

          <div className="grid gap-2">
            <label htmlFor="image" className="text-sm font-medium">
              Image URL
            </label>
            <input
              id="image"
              type="url"
              placeholder="https://example.com/image.jpg"
              {...register('image')}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            />
            {errors.image && (
              <p className="text-sm text-destructive">{errors.image.message}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <label htmlFor="price" className="text-sm font-medium">
                Price
              </label>
              <input
                id="price"
                type="number"
                step="0.01"
                {...register('price')}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              />
              {errors.price && (
                <p className="text-sm text-destructive">
                  {errors.price.message}
                </p>
              )}
            </div>
            <div className="grid gap-2">
              <label htmlFor="stock" className="text-sm font-medium">
                Stock
              </label>
              <input
                id="stock"
                type="number"
                {...register('stock')}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              />
              {errors.stock && (
                <p className="text-sm text-destructive">
                  {errors.stock.message}
                </p>
              )}
            </div>
          </div>

          <div className="grid gap-2">
            <label htmlFor="category" className="text-sm font-medium">
              Category
            </label>
            <select
              id="category"
              {...register('category')}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <option value="">Select a category</option>

              {categories.map((category) => (
                <option key={category.id} value={category.name}>
                  {category.name}
                </option>
              ))}
            </select>

            {errors.category && (
              <p className="text-sm text-destructive">
                {errors.category.message}
              </p>
            )}
          </div>

          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="isPublic"
              {...register('isPublic')}
              className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
            />
            <label htmlFor="isPublic" className="text-sm font-medium">
              Public (Visible to customers)
            </label>
          </div>
        </div>
        <div className="relative h-96 flex-1">
          {previewImage && (
            <Image
              src={previewImage}
              alt="Preview"
              fill
              sizes="100%"
              objectFit="contain"
            />
          )}
        </div>
      </div>

      <div className="flex gap-4">
        {process.env.NEXT_PUBLIC_APP_ENV === 'development' && !isEditing && (
          <button
            type="button"
            onClick={generateMockData}
            className="bg-secondary text-secondary-foreground px-4 py-2 rounded-md hover:bg-secondary/90 disabled:opacity-50"
          >
            🎲 Generate Mock Data
          </button>
        )}
        <button
          type="submit"
          disabled={isSubmitting || (isEditing && !isDirty)}
          className="bg-primary text-primary-foreground px-4 py-2 rounded-md hover:bg-primary/90 disabled:opacity-50"
        >
          {isSubmitting
            ? 'Saving...'
            : isEditing
              ? 'Update Product'
              : 'Create Product'}
        </button>
      </div>
    </form>
  )
}
