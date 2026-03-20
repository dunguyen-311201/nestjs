'use client'

import { PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js'
import React, { FormEvent, Suspense, useState } from 'react'
import { toast } from 'sonner'

import { formatCurrency } from '@/lib/utils'

function CheckoutForm({ cartTotal }: { cartTotal: number }) {
  const stripe = useStripe()
  const elements = useElements()
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!stripe || !elements) {
      // Stripe.js hasn't yet loaded.
      // Make sure to disable form submission until Stripe.js has loaded.
      return
    }

    setIsLoading(true)

    try {
      const { error } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          // Make sure to change this to your payment completion page
          return_url: `${process.env.NEXT_PUBLIC_BASE_URL}/checkout/success?p=true`,
        },
      })

      // This point will only be reached if there is an immediate error when
      // confirming the payment. Otherwise, your customer will be redirected to
      // your `return_url`. For some payment methods like iDEAL, your customer will
      // be redirected to an intermediate site first to authorize the payment, then
      // redirected to the `return_url`.
      if (error.type === 'card_error' || error.type === 'validation_error') {
        toast.error(error.message || 'An unexpected error occurred.')
      } else {
        toast.error('An unexpected error occurred.')
      }
    } catch (error) {
      console.error('Error: ', error)
      let message = 'An unexpected error occurred.'
      if (error instanceof Error) {
        message = error.message
      }
      toast.error(message)
    } finally {
      setIsLoading(false)
    }
  }

  const [isPaymentReady, setIsPaymentReady] = useState(false)

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Suspense fallback={<div>Loading payment element...</div>}>
        <PaymentElement
          options={{ layout: 'accordion' }}
          onChange={(e) => {
            setIsPaymentReady(e.complete)
          }}
        />
      </Suspense>

      <button
        type="submit"
        disabled={isLoading || !stripe || !elements || !isPaymentReady}
        className="w-full bg-primary text-primary-foreground py-4 rounded-md font-bold hover:bg-primary/90 transition-colors disabled:opacity-50"
      >
        {isLoading ? 'Processing...' : `Pay ${formatCurrency(cartTotal)}`}
      </button>
    </form>
  )
}

export default CheckoutForm
