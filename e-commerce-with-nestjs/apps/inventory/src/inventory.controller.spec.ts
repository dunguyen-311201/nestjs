import { Test, TestingModule } from '@nestjs/testing';
import { Order } from '@app/shared';
import { InventoryController } from './inventory.controller';
import { InventoryService } from './inventory.service';

const mockInventoryService = {
  handleOrderCreated: jest.fn(),
};

const makeOrder = (overrides: Partial<Order> = {}): Order => ({
  id: 'order-uuid',
  items: [{ productId: 'prod-uuid', quantity: 10 }],
  ...overrides,
});

describe('InventoryController', () => {
  let controller: InventoryController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [InventoryController],
      providers: [
        { provide: InventoryService, useValue: mockInventoryService },
      ],
    }).compile();

    controller = module.get<InventoryController>(InventoryController);
    jest.clearAllMocks();
  });

  describe('healthCheck', () => {
    it('should return { status: "ok" }', () => {
      expect(controller.healthCheck()).toEqual({ status: 'ok' });
    });
  });

  describe('handleOrderCreated', () => {
    it('should delegate to service', async () => {
      mockInventoryService.handleOrderCreated.mockResolvedValue(undefined);
      const order = makeOrder();

      await controller.handleOrderCreated(order);

      expect(mockInventoryService.handleOrderCreated).toHaveBeenCalledWith(
        order,
      );
    });

    it('should return the promise from service', () => {
      mockInventoryService.handleOrderCreated.mockResolvedValue(undefined);

      const result = controller.handleOrderCreated(makeOrder());

      expect(result).toBeInstanceOf(Promise);
    });
  });
});
