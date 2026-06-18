import { Test, TestingModule } from '@nestjs/testing';
import { of } from 'rxjs';
import { EVENTS, MESSAGES } from '@app/constants';
import { Order } from '@app/shared';
import { InventoryService } from './inventory.service';

const mockOrderClient = { emit: jest.fn() };
const mockProductClient = { send: jest.fn() };

const makeOrder = (
  items: { productId: string; quantity: number }[] = [
    { productId: 'prod-uuid', quantity: 10 },
  ],
  id = 'order-uuid',
): Order => ({ id, items });

describe('InventoryService', () => {
  let service: InventoryService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InventoryService,
        { provide: 'ORDER_SERVICE', useValue: mockOrderClient },
        { provide: 'PRODUCT_SERVICE', useValue: mockProductClient },
      ],
    }).compile();

    service = module.get<InventoryService>(InventoryService);
    jest.clearAllMocks();
  });

  describe('handleOrderCreated', () => {
    it('should call product service with RESERVE_STOCK and the order', async () => {
      mockProductClient.send.mockReturnValue(
        of({ success: true, message: 'Order processed successfully' }),
      );
      const order = makeOrder();

      await service.handleOrderCreated(order);

      expect(mockProductClient.send).toHaveBeenCalledWith(
        MESSAGES.RESERVE_STOCK,
        order,
      );
    });

    it('should emit ORDER_PROCESSED with success when product service returns success', async () => {
      mockProductClient.send.mockReturnValue(
        of({ success: true, message: 'Order processed successfully' }),
      );

      await service.handleOrderCreated(makeOrder());

      expect(mockOrderClient.emit).toHaveBeenCalledWith(
        EVENTS.ORDER_PROCESSED,
        {
          orderId: 'order-uuid',
          success: true,
          message: 'Order processed successfully',
        },
      );
    });

    it('should emit ORDER_PROCESSED with failure when product service returns failure', async () => {
      mockProductClient.send.mockReturnValue(
        of({
          success: false,
          message: 'Insufficient stock for product prod-uuid',
        }),
      );

      await service.handleOrderCreated(makeOrder());

      expect(mockOrderClient.emit).toHaveBeenCalledWith(
        EVENTS.ORDER_PROCESSED,
        {
          orderId: 'order-uuid',
          success: false,
          message: 'Insufficient stock for product prod-uuid',
        },
      );
    });

    it('should emit exactly once per order regardless of outcome', async () => {
      mockProductClient.send.mockReturnValue(
        of({ success: true, message: 'Order processed successfully' }),
      );

      await service.handleOrderCreated(makeOrder());

      expect(mockOrderClient.emit).toHaveBeenCalledTimes(1);
    });

    it('should pass the full order payload to the product service', async () => {
      mockProductClient.send.mockReturnValue(
        of({ success: true, message: 'Order processed successfully' }),
      );
      const order = makeOrder([
        { productId: 'prod-1', quantity: 3 },
        { productId: 'prod-2', quantity: 7 },
      ]);

      await service.handleOrderCreated(order);

      expect(mockProductClient.send).toHaveBeenCalledWith(
        MESSAGES.RESERVE_STOCK,
        order,
      );
    });
  });
});
