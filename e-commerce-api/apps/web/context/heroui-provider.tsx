'use client'

import { HeroUIProvider } from '@heroui/react'
import { useRouter } from 'next/navigation'
import { type ReactNode } from 'react'

interface AppProviderProps {
  children: ReactNode
  className?: string
}

export function AppProvider(props: AppProviderProps) {
  const { children, className } = props
  const router = useRouter()

  return (
    <HeroUIProvider navigate={router.push} className={className}>
      {children}
    </HeroUIProvider>
  )
}
