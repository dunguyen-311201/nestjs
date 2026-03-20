import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'

import { NextResponse } from 'next/server'

// export default clerkMiddleware();

const isPublicRoute = createRouteMatcher([
  '/', // Home page
  '/sign-in(.*)', // Clerk auth pages
  '/sign-up(.*)',
  '/sign-out(.*)',
  '/products(.*)',
  '/api/cart(.*)',
  '/api/checkout(.*)',
])

const isAdminRoute = createRouteMatcher(['/admin(.*)', '/api/admin(.*)'])

export default clerkMiddleware(async (auth, req) => {
  if (!isPublicRoute(req)) {
    await auth.protect()
  }

  const { sessionClaims } = await auth()

  const isAdmin = sessionClaims?.org_role === 'org:admin'

  if (isAdmin && !isAdminRoute(req)) {
    return NextResponse.redirect(new URL('/admin', req.url))
  }

  if (isAdminRoute(req) && !isAdmin) {
    return NextResponse.redirect(new URL('/', req.url))
  }
})

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
}
