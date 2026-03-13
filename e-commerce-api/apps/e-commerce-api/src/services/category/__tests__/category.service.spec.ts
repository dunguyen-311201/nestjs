import { createMockRepository, loggerMock } from '#test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { CategoryService } from '../index'

describe('CategoryService', () => {
  let categoryService: CategoryService
  let categoryRepositoryMock: ReturnType<typeof createMockRepository>

  beforeEach(() => {
    vi.clearAllMocks()

    categoryRepositoryMock = createMockRepository()

    categoryService = new CategoryService(
      categoryRepositoryMock as any,
      loggerMock,
    )
  })

  describe('getAll', () => {
    it('should fetch all categories', async () => {
      const mockCategories = [
        { id: 1, name: 'Category 1' },
        { id: 2, name: 'Category 2' },
      ]
      categoryRepositoryMock.find.mockResolvedValue(mockCategories)

      const result = await categoryService.getAll()

      expect(result).toEqual(mockCategories)
      expect(categoryRepositoryMock.find).toHaveBeenCalled()
      expect(loggerMock.info).toHaveBeenCalledWith('Fetching all categories')
      expect(loggerMock.info).toHaveBeenCalledWith(
        { count: mockCategories.length },
        'Categories fetched successfully',
      )
    })
  })
})
