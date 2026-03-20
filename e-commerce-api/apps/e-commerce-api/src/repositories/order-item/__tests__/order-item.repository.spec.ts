import { describe, expect, it } from 'vitest'

import { OrderItemRepository } from '../index'

describe('OrderItemRepository', () => {
  it('should be defined', () => {
    const repository = new OrderItemRepository({
      target: {} as any,
      manager: {} as any,
    } as any)
    expect(repository).toBeDefined()
    expect(repository).toBeInstanceOf(OrderItemRepository)
  })
})
