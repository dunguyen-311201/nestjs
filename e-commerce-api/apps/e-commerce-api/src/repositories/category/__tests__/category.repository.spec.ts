import { describe, expect, it } from 'vitest'

import { CategoryRepository } from '../index'

describe('CategoryRepository', () => {
  it('should be defined', () => {
    const mockManager: any = {}
    const repository = new CategoryRepository({
      target: {} as any,
      manager: mockManager,
    } as any)
    expect(repository).toBeDefined()
    expect(repository).toBeInstanceOf(CategoryRepository)
  })
})
