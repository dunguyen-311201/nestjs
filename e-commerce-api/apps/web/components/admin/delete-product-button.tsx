'use client'

import { Trash2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useTransition } from 'react'
import { toast } from 'sonner'

import { API_ROUTES, del } from '@/lib/api'
import { getClientEndpoint } from '@/lib/client'

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'

interface DeleteProductButtonProps {
  productId: string
}

export const deleteProduct = async (productId: string) => {
  await del(getClientEndpoint(API_ROUTES.PRODUCT.DELETE(productId)))
}

export function DeleteProductButton({ productId }: DeleteProductButtonProps) {
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  const handleDelete = () => {
    startTransition(async () => {
      try {
        await deleteProduct(productId)
        router.refresh()
        toast.success('Product deleted successfully')
      } catch {
        toast.error('Failed to delete product')
      }
    })
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <button
          title="Delete product"
          disabled={isPending}
          className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-input bg-background hover:bg-destructive hover:text-destructive-foreground disabled:opacity-50"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
          <AlertDialogDescription>
            This action cannot be undone. This will permanently delete the
            product from your inventory.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isPending ? 'Deleting...' : 'Delete'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
