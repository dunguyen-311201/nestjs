'use client'

import { Spinner } from '@heroui/spinner'
import React, { useState } from 'react'

export interface LoadingRef {
  showLoading: () => void
  hideLoading: () => void
}

/**
 * Loading indicator component with optional full-screen overlay
 */
export const LoadingIndicator = ({
  loading,
  fullScreen,
}: {
  loading: boolean
  fullScreen?: boolean
}) => {
  if (!loading) return null
  return (
    <div
      className={
        fullScreen
          ? 'fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm'
          : 'flex items-center justify-center bg-background/50'
      }
    >
      <Spinner size="lg" label="Loading..." color="success" />
    </div>
  )
}

/**
 * Loading wrapper component that can be controlled via ref
 * Useful for showing loading states during navigation or async operations
 *
 * @example
 * ```tsx
 * const loadingRef = useRef<LoadingRef | null>(null)
 *
 * <Loading ref={loadingRef}>
 *   <YourContent />
 * </Loading>
 *
 * // Show loading
 * loadingRef.current?.showLoading()
 * // Hide loading
 * loadingRef.current?.hideLoading()
 * ```
 */
function Loading({
  children,
  ref,
}: React.PropsWithChildren<{
  ref: React.RefObject<LoadingRef | null>
}>) {
  const [loading, setLoading] = useState(false)
  ref.current = {
    showLoading: () => setLoading(true),
    hideLoading: () => setLoading(false),
  }
  return (
    <>
      {children}
      <LoadingIndicator loading={loading} fullScreen />
    </>
  )
}

export default Loading
