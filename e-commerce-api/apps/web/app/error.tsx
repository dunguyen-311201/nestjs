'use client'

import { Button } from '@heroui/react'
import { AlertCircle, Home, RefreshCw } from 'lucide-react'
import Link from 'next/link'
import { useEffect } from 'react'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error(error)
  }, [error])

  return (
    <div className="flex h-[80vh] w-full flex-col items-center justify-center gap-6 px-4 text-center">
      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-danger/10 text-danger animate-in zoom-in-50 duration-300">
        <AlertCircle className="h-10 w-10" />
      </div>

      <div className="space-y-2 max-w-md">
        <h2 className="text-2xl font-bold tracking-tight">
          Something went wrong!
        </h2>
        <p className="text-default-500">
          {error.message || 'An unexpected error occurred. Please try again.'}
        </p>
        <p className="text-xs text-default-400 font-mono bg-default-100 p-2 rounded mt-2">
          Digest: {error.digest}
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 min-w-[200px]">
        <Button
          color="primary"
          variant="solid"
          onPress={() => reset()}
          startContent={<RefreshCw className="h-4 w-4" />}
        >
          Try again
        </Button>

        <Button
          as={Link}
          href="/"
          variant="bordered"
          startContent={<Home className="h-4 w-4" />}
        >
          Go to Home
        </Button>
      </div>
    </div>
  )
}
