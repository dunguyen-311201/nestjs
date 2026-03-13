'use client'

import { Elements } from '@stripe/react-stripe-js'
import { loadStripe } from '@stripe/stripe-js'

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLIC_KEY!)

const Provider = ({
  clientSecret,
  children,
}: React.PropsWithChildren<{ clientSecret: string }>) => {
  return (
    <Elements
      stripe={stripePromise}
      options={{
        loader: 'auto',
        appearance: { theme: 'stripe' },
        clientSecret,
      }}
    >
      {children}
    </Elements>
  )
}

export default Provider
