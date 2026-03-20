import { describe, expect, it } from 'vitest'

import {
  formatAmount,
  formatPaymentMethod,
  formatStripeAmount,
  formatStripeDate,
} from '../format'

describe('format utils', () => {
  describe('formatStripeAmount', () => {
    it('should format stripe amount (cents) to currency string', () => {
      expect(formatStripeAmount(2000, 'usd')).toBe('$20.00')
    })

    it('should handle different locales', () => {
      // Note: precise output depends on node/browser locale data, generally works
      const result = formatStripeAmount(2000, 'eur', 'de-DE')
      expect(result).toMatch(/20,00\s?€/)
    })
  })

  describe('formatAmount', () => {
    it('should format normal amount to currency string', () => {
      expect(formatAmount(20, 'usd')).toBe('$20.00')
    })
  })

  describe('formatStripeDate', () => {
    it('should format unix timestamp to date string', () => {
      // 1704067200 = Jan 1 2024
      expect(formatStripeDate(1704067200)).toBe('January 1, 2024')
    })
  })

  describe('formatPaymentMethod', () => {
    it('should format card payment method', () => {
      const pm: any = {
        card: { brand: 'visa', last4: '4242' },
        type: 'card',
      }
      expect(formatPaymentMethod(pm)).toBe('VISA •••• 4242')
    })

    it('should format link payment method', () => {
      const pm: any = {
        link: { email: 'test@example.com' },
        type: 'link',
      }
      expect(formatPaymentMethod(pm)).toBe('Link test@example.com')
    })

    it('should return empty string for unknown/missing types', () => {
      expect(formatPaymentMethod({} as any)).toBe('')
      expect(formatPaymentMethod({} as any)).toBe('')
    })
  })
})
