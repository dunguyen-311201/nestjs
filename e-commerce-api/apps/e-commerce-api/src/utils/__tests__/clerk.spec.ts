import { describe, expect, it } from 'vitest'

import { isClerkAPIResponseError } from '../clerk'

describe('isClerkAPIResponseError', () => {
  it('should return true for valid Clerk error', () => {
    const error = {
      clerkError: true,
      errors: [{ code: 'some_error' }],
    }
    expect(isClerkAPIResponseError(error)).toBe(true)
  })

  it('should return false for generic error', () => {
    expect(isClerkAPIResponseError(new Error('foo'))).toBe(false)
  })

  it('should return false for null/undefined', () => {
    expect(isClerkAPIResponseError(null)).toBe(false)
    expect(isClerkAPIResponseError(undefined)).toBe(false)
  })

  it('should return false if errors array is empty', () => {
    const error = {
      clerkError: true,
      errors: [],
    }
    expect(isClerkAPIResponseError(error)).toBe(false)
  })
})
