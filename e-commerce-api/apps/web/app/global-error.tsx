'use client'

import { AlertCircle, Home, RefreshCw } from 'lucide-react'
import Link from 'next/link'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html lang="en">
      <body>
        <div className="flex min-h-screen w-full flex-col items-center justify-center gap-6 px-4 text-center bg-background text-foreground">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-red-100 text-red-600">
            <AlertCircle className="h-10 w-10" />
          </div>

          <div className="space-y-2 max-w-md">
            <h2 className="text-2xl font-bold tracking-tight">
              A critical error occurred!
            </h2>
            <p className="text-gray-500">
              {error.message || 'An unexpected error occurred. Please try again.'}
            </p>
            {error.digest && (
              <p className="text-xs text-gray-400 font-mono bg-gray-100 p-2 rounded mt-2">
                Digest: {error.digest}
              </p>
            )}
          </div>

          <div className="flex flex-col sm:flex-row gap-4 min-w-[200px]">
            <button
              onClick={() => reset()}
              className="flex items-center justify-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-md hover:bg-primary/90"
            >
              <RefreshCw className="h-4 w-4" />
              Try again
            </button>

            <Link
              href="/"
              className="flex items-center justify-center gap-2 border border-gray-300 px-4 py-2 rounded-md hover:bg-gray-50"
            >
              <Home className="h-4 w-4" />
              Go to Home
            </Link>
          </div>
        </div>
      </body>
    </html>
  )
}
