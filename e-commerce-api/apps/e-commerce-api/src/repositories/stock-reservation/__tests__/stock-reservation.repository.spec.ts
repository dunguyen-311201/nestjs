import { describe, expect, it } from 'vitest'

import { StockReservationRepository } from '../index'

describe('StockReservationRepository', () => {
  it('should be defined', () => {
    const repository = new StockReservationRepository({
      target: {} as any,
      manager: {} as any,
    } as any)
    expect(repository).toBeDefined()
    expect(repository).toBeInstanceOf(StockReservationRepository)
  })
})
