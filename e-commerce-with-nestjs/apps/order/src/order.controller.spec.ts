import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { JwtAuthGuard, RolesGuard } from '@app/common';
import { UserRole } from '@app/shared';
import { OrderController } from './order.controller';
import { OrderService } from './order.service';
import { Order, OrderStatus } from './entities/order.entity';
import { OrderItem } from './entities/order-item.entity';

const baseItem = (): OrderItem => ({
  id: 'item-uuid',
  productId: 'prod-uuid',
  quantity: 2,
  unitPrice: 10,
  order: null as unknown as Order,
});

const baseOrder = (): Order => ({
  id: 'uuid-1',
  customerId: 'user-uuid',
  totalPrice: 20,
  status: OrderStatus.PENDING,
  createdAt: new Date(),
  items: [baseItem()],
});

const mockOrderService = {
  create: jest.fn(),
  findAll: jest.fn(),
  findOne: jest.fn(),
  updateStatus: jest.fn(),
  handleOrderProcessed: jest.fn(),
};

const mockJwtAuthGuard = { canActivate: jest.fn().mockReturnValue(true) };
const mockRolesGuard = { canActivate: jest.fn().mockReturnValue(true) };

describe('OrderController', () => {
  let controller: OrderController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [OrderController],
      providers: [{ provide: OrderService, useValue: mockOrderService }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue(mockJwtAuthGuard)
      .overrideGuard(RolesGuard)
      .useValue(mockRolesGuard)
      .compile();

    controller = module.get<OrderController>(OrderController);
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should return the created order', async () => {
      const dto = {
        customerId: 'user-uuid',
        items: [{ productId: 'prod-uuid', quantity: 2, unitPrice: 10 }],
      };
      const order = baseOrder();
      mockOrderService.create.mockResolvedValue(order);

      const result = await controller.create(dto);

      expect(mockOrderService.create).toHaveBeenCalledWith(dto);
      expect(result).toEqual(order);
    });
  });

  describe('findAll', () => {
    it('should return all orders from service', async () => {
      const orders = [baseOrder()];
      mockOrderService.findAll.mockResolvedValue(orders);

      const result = await controller.findAll();

      expect(mockOrderService.findAll).toHaveBeenCalledWith(
        undefined,
        undefined,
      );
      expect(result).toEqual(orders);
    });

    it('should forward page and limit to service', async () => {
      mockOrderService.findAll.mockResolvedValue([]);

      await controller.findAll(2, 5);

      expect(mockOrderService.findAll).toHaveBeenCalledWith(2, 5);
    });
  });

  describe('findOne', () => {
    const user = { sub: 'user-uuid', username: 'alice', role: UserRole.USER };

    it('should return a single order', async () => {
      const order = baseOrder();
      mockOrderService.findOne.mockResolvedValue(order);

      const result = await controller.findOne('uuid-1', user);

      expect(mockOrderService.findOne).toHaveBeenCalledWith('uuid-1', user);
      expect(result).toEqual(order);
    });

    it('should propagate NotFoundException from service', async () => {
      mockOrderService.findOne.mockRejectedValue(new NotFoundException());

      await expect(controller.findOne('missing', user)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('updateStatus', () => {
    it('should delegate to service with the new status', async () => {
      const order = { ...baseOrder(), status: OrderStatus.CANCELLED };
      mockOrderService.updateStatus.mockResolvedValue(order);

      const result = await controller.updateStatus('uuid-1', {
        status: OrderStatus.CANCELLED,
      });

      expect(mockOrderService.updateStatus).toHaveBeenCalledWith(
        'uuid-1',
        OrderStatus.CANCELLED,
      );
      expect(result).toEqual(order);
    });
  });

  describe('handleOrderProcessed', () => {
    it('should delegate to service', async () => {
      mockOrderService.handleOrderProcessed.mockResolvedValue(undefined);

      await controller.handleOrderProcessed({
        orderId: 'uuid-1',
        success: true,
        message: 'ok',
      });

      expect(mockOrderService.handleOrderProcessed).toHaveBeenCalledWith({
        orderId: 'uuid-1',
        success: true,
        message: 'ok',
      });
    });
  });
});
