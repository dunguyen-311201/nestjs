'use client'

import {
  Button,
  Dropdown,
  DropdownItem,
  DropdownMenu,
  DropdownSection,
  DropdownTrigger,
} from '@heroui/react'
import {
  Archive,
  Copy,
  Edit,
  FileText,
  MoreHorizontal,
  Send,
  Trash2,
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { toast } from 'sonner'

import { API_ROUTES, post, put } from '@/lib/api'
import { getClientEndpoint } from '@/lib/client'
import { Product } from '@/lib/types'

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

interface ProductActionsDropdownProps {
  product: Product
}

type ConfirmAction = 'delete' | 'archive' | null

export function ProductActionsDropdown({
  product,
}: ProductActionsDropdownProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null)
  const router = useRouter()

  // Show confirm modal before actions exclude edit
  const handleAction = async (key: React.Key) => {
    switch (key) {
      case 'edit':
        router.push(`/admin/products/${product.id}`)
        break
      case 'duplicate':
        await handleDuplicate()
        break
      case 'publish':
        await updateStatus('published')
        break
      case 'archive':
        setConfirmAction('archive')
        break
      case 'draft':
        await updateStatus('draft')
        break
      case 'restore':
        await updateStatus('published')
        break
      case 'delete':
        setConfirmAction('delete')
        break
    }
  }

  const handleConfirm = async () => {
    if (!confirmAction) return

    switch (confirmAction) {
      case 'archive':
        await updateStatus('archived')
        break
      case 'delete':
        await updateStatus('deleted')
        break
    }
    setConfirmAction(null)
  }

  const handleDuplicate = async () => {
    if (isLoading) return
    setIsLoading(true)
    try {
      await post(getClientEndpoint(API_ROUTES.PRODUCT.CREATE), {
        name: `${product.name} (Copy)`,
        description: product.description,
        price: product.price,
        stock: product.stock,
        category: product.category,
        images: product.images || [],
        status: 'draft',
      })

      toast.success('Product duplicated successfully')
      router.refresh()
    } catch (error) {
      console.error(error)
      toast.error('Failed to duplicate product')
    } finally {
      setIsLoading(false)
    }
  }

  const updateStatus = async (status: string) => {
    if (isLoading) return
    setIsLoading(true)
    try {
      await put(getClientEndpoint(API_ROUTES.PRODUCT.UPDATE(product.id)), {
        status,
      })

      toast.success(`Product status updated to ${status}`)
      router.refresh()
    } catch (error) {
      toast.error('Failed to update product status')
      console.error(error)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <>
      <Dropdown isDisabled={isLoading}>
        <DropdownTrigger>
          <Button variant="light" isIconOnly isLoading={isLoading} size="sm">
            <MoreHorizontal className="h-4 w-4 text-default-500" />
          </Button>
        </DropdownTrigger>
        <DropdownMenu
          aria-label="Product Actions"
          onAction={handleAction}
          variant="flat"
          className="shadow-lg bg-background z-50 rounded-md border border-default-200"
          disabledKeys={
            product.status === 'deleted' ? ['edit', 'duplicate'] : []
          }
        >
          <DropdownSection title="Actions" showDivider>
            <DropdownItem
              key="edit"
              startContent={<Edit className="h-4 w-4" />}
              description="Edit details"
              className="data-[disabled=true]:opacity-50 data-[disabled=true]:cursor-not-allowed"
            />
            <DropdownItem
              key="duplicate"
              startContent={<Copy className="h-4 w-4" />}
              description="Duplicate"
              className="data-[disabled=true]:opacity-50 data-[disabled=true]:cursor-not-allowed"
            />
          </DropdownSection>

          <DropdownSection title="Status" showDivider>
            {product.status === 'deleted' ? (
              <DropdownItem
                key="restore"
                startContent={<Edit className="h-4 w-4" />}
                description="Restore"
              />
            ) : null}
            {product.status !== 'published' ? (
              <DropdownItem
                key="publish"
                startContent={<Send className="h-4 w-4" />}
                className="text-success"
                color="success"
                description="Publish"
              />
            ) : null}
            {product.status !== 'archived' ? (
              <DropdownItem
                key="archive"
                startContent={<Archive className="h-4 w-4" />}
                description="Archive"
              />
            ) : null}
            {product.status !== 'draft' ? (
              <DropdownItem
                key="draft"
                startContent={<FileText className="h-4 w-4" />}
                description="Mark as Draft"
              />
            ) : null}
          </DropdownSection>

          <DropdownSection title="Danger Zone">
            <DropdownItem
              key="delete"
              className="text-danger"
              color="danger"
              startContent={<Trash2 className="h-4 w-4" />}
              description="Delete"
            />
          </DropdownSection>
        </DropdownMenu>
      </Dropdown>

      <AlertDialog
        open={!!confirmAction}
        onOpenChange={(open) => !open && setConfirmAction(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmAction === 'delete'
                ? 'This action cannot be undone. This will permanently delete the product from our servers.'
                : 'This will render the product unavailable for purchase.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirm}
              className={
                confirmAction === 'delete'
                  ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90'
                  : ''
              }
            >
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
