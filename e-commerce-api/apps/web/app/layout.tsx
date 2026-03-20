import {
  ClerkProvider,
  OrganizationSwitcher,
  SignInButton,
  SignUpButton,
  SignedIn,
  SignedOut,
  UserButton,
} from '@clerk/nextjs'
import { auth } from '@clerk/nextjs/server'

import { type Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import Link from 'next/link'
import { Toaster } from 'sonner'

import { AppProvider } from '@/context/heroui-provider'
import QueryProvider from '@/context/query-provider'

import { ModeToggle } from '@/components/mode-toggle'
import { ThemeProvider } from '@/components/theme-provider'

import './globals.css'

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
})

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
})

export const metadata: Metadata = {
  title: 'E-Commerce Store',
  description: 'Built with Next.js and Clerk',
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const { sessionClaims } = await auth()

  const isAdmin = sessionClaims?.org_role === 'org:admin'

  return (
    <ClerkProvider>
      <html lang="en" suppressHydrationWarning>
        <body
          className={`${geistSans.variable} ${geistMono.variable} antialiased`}
        >
          <ThemeProvider
            attribute="data-theme"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
          >
            <QueryProvider>
              <AppProvider>
                <header className="flex justify-between items-center p-4 h-16 border-b bg-background">
                  <div className="flex items-center gap-4">
                    <Link href="/" className="font-bold text-xl">
                      MyStore
                    </Link>
                    <OrganizationSwitcher hidePersonal={isAdmin} />
                  </div>
                  <div className="flex items-center gap-4">
                    {!isAdmin && (
                      <>
                        <Link
                          href="/cart"
                          className="relative p-2 hover:bg-accent rounded-md"
                        >
                          🛒
                        </Link>
                        <SignedIn>
                          <Link
                            href="/orders"
                            className="text-sm font-medium hover:underline"
                          >
                            Orders
                          </Link>
                        </SignedIn>
                      </>
                    )}

                    <ModeToggle />
                    <SignedOut>
                      <SignInButton mode="redirect" />
                      <SignUpButton mode="redirect">
                        <button className="bg-primary text-primary-foreground rounded-full font-medium text-sm h-10 px-4 cursor-pointer hover:bg-primary/90">
                          Sign Up
                        </button>
                      </SignUpButton>
                    </SignedOut>
                    <SignedIn>
                      <UserButton />
                    </SignedIn>
                  </div>
                </header>
                {children}
                <Toaster />
              </AppProvider>
            </QueryProvider>
          </ThemeProvider>
        </body>
      </html>
    </ClerkProvider>
  )
}
