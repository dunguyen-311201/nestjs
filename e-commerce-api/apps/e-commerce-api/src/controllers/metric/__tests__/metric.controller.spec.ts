import { createMockReply, createMockRequest } from '#test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { IMetricService } from '#services/types'

import { MetricController } from '../index'

// Mock dependencies
const mockMetricService = {
  getDashboardStats: vi.fn(),
}

describe('MetricController', () => {
  let metricController: MetricController

  beforeEach(() => {
    vi.clearAllMocks()

    metricController = new MetricController(
      mockMetricService as unknown as IMetricService,
    )
  })

  describe('getProductMetrics', () => {
    it('should retrieve metrics successfully', async () => {
      const mockRequest = createMockRequest()
      const mockReply = createMockReply()
      const mockMetrics = {
        totalProducts: 10,
        totalStock: 100,
        totalValue: 1000,
        updatedAt: '2026-02-04T00:00:00Z',
      }
      mockMetricService.getDashboardStats.mockResolvedValue(mockMetrics)

      await metricController.getProductMetrics(mockRequest, mockReply)

      expect(mockMetricService.getDashboardStats).toHaveBeenCalled()
      expect(mockReply.send).toHaveBeenCalledWith(mockMetrics)
    })
  })
})
