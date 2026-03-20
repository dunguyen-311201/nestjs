import { CheckCircle2 } from 'lucide-react'
import Link from 'next/link'

export default function CheckoutSuccessPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-4 text-center">
      <div className="bg-green-100 dark:bg-green-900/20 p-4 rounded-full mb-6">
        <CheckCircle2 className="h-16 w-16 text-green-600 dark:text-green-500" />
      </div>
      <h1 className="text-4xl font-bold mb-4 text-foreground">
        Order Placed Successfully!
      </h1>
      <p className="text-muted-foreground max-w-md mb-8">
        Thank you for your purchase. We have received your order and will send
        you a confirmation email shortly.
      </p>
      <Link
        href="/products"
        className="bg-primary text-primary-foreground px-8 py-3 rounded-md font-medium hover:bg-primary/90 transition-colors"
      >
        Continue Shopping
      </Link>
    </div>
  )
}
