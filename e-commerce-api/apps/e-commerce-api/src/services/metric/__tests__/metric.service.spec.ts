import { createMockRepository, loggerMock } from '#test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { MetricService } from '../index'

describe('MetricService', () => {
  let metricService: MetricService
  let productRepositoryMock: ReturnType<typeof createMockRepository>

  beforeEach(() => {
    vi.clearAllMocks()

    productRepositoryMock = createMockRepository({
      getAdminMetrics: vi.fn(),
    })

    metricService = new MetricService(productRepositoryMock as any, loggerMock)

    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-02-04T20:00:00Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('getDashboardStats', () => {
    it('should fetch and format dashboard metrics', async () => {
      const mockRawData = {
        totalProducts: '10',
        totalStock: '100',
        totalValue: '1000',
      }
      productRepositoryMock.getAdminMetrics.mockResolvedValue(mockRawData)

      const result = await metricService.getDashboardStats()

      expect(result).toEqual({
        totalProducts: 10,
        totalStock: 100,
        totalValue: 1000,
        updatedAt: '2026-02-04T20:00:00.000Z',
      })
      expect(productRepositoryMock.getAdminMetrics).toHaveBeenCalled()
    })

    it('should return 0s if raw data is missing', async () => {
      productRepositoryMock.getAdminMetrics.mockResolvedValue(null)

      const result = await metricService.getDashboardStats()

      expect(result.totalProducts).toBe(0)
      expect(result.totalStock).toBe(0)
      expect(result.totalValue).toBe(0)
    })
  })
})
