import { describe, expect, it } from 'vitest'

import { uncapitalize } from '../string'

describe('uncapitalize', () => {
  it('should uncapitalize the first letter of a string', () => {
    expect(uncapitalize('Hello')).toBe('hello')
  })

  it('should return empty string if input is empty', () => {
    expect(uncapitalize('')).toBe('')
  })

  it('should return same string if first letter is already lowercase', () => {
    expect(uncapitalize('hello')).toBe('hello')
  })
})
