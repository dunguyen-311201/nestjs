import { ClerkAPIResponseError } from '#types'

export const isClerkAPIResponseError = (
  error: unknown,
): error is ClerkAPIResponseError => {
  return !!(
    typeof error === 'object' &&
    error &&
    'clerkError' in error &&
    error.clerkError &&
    'errors' in error &&
    Array.isArray(error.errors) &&
    error.errors.length
  )
}
