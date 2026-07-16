/* eslint-disable @typescript-eslint/unbound-method -- jest.fn() mocks flagged as false positives */
import { NotFoundException } from '@nestjs/common';
import { OrderService } from './order.service';
import { IOrderRepository } from './ports/order-repository.port';
import { IPricingPort } from './ports/pricing.port';
import { IIdempotencyStore } from './ports/idempotency-store.port';
import { ParcelType } from './entities/parcel.enums';
import { CreateOrderDto, PaymentType } from './dto/create-order.dto';
import { ShipmentOrderStatus } from './entities/shipment-order-status.enum';
import { ShipmentOrder } from './entities/shipment-order.entity';

function createOrderDto(): CreateOrderDto {
  return {
    sender: {
      name: 'Alice',
      phone: '0900000000',
      address: '1 Alice St',
      region_code: 'HN01',
    },
    recipient: {
      name: 'Bob',
      phone: '0911111111',
      address: '2 Bob St',
      region_code: 'SG01',
    },
    parcels: [{ declared_weight_grams: 500, type: ParcelType.PARCEL }],
    payment_type: PaymentType.PREPAID_STRIPE,
  };
}

describe('OrderService', () => {
  let repository: jest.Mocked<IOrderRepository>;
  let pricing: jest.Mocked<IPricingPort>;
  let idempotencyStore: jest.Mocked<IIdempotencyStore>;
  let service: OrderService;

  beforeAll(() => {
    process.env.PII_ENCRYPTION_KEY = 'ab'.repeat(32);
  });

  beforeEach(() => {
    repository = {
      createOrder: jest.fn(),
      findById: jest.fn(),
      findByCreatedByUserId: jest.fn(),
      findAll: jest.fn(),
    };
    pricing = {
      getPrice: jest.fn(),
    };
    idempotencyStore = {
      get: jest.fn(),
      set: jest.fn(),
    };
    service = new OrderService(repository, pricing, idempotencyStore);
  });

  it('locks price/ETA from Pricing and persists the order + parcels (BR-01)', async () => {
    idempotencyStore.get.mockResolvedValue(null);
    pricing.getPrice.mockResolvedValue({
      rateCardId: 'rate-card-1',
      routeId: 'route-1',
      priceCents: 5000,
      slaExpectedDelivery: new Date('2026-07-15T00:00:00Z'),
    });
    const createdOrder = {
      id: 'order-1',
      priceCents: 5000,
      expectedDeliveryAt: new Date('2026-07-15T00:00:00Z'),
      status: ShipmentOrderStatus.CREATED,
    } as ShipmentOrder;
    repository.createOrder.mockResolvedValue(createdOrder);

    const result = await service.createOrder(createOrderDto(), 'idem-key-1');

    expect(pricing.getPrice).toHaveBeenCalledWith(
      'HN01',
      'SG01',
      ParcelType.PARCEL,
    );
    expect(repository.createOrder).toHaveBeenCalledWith(
      expect.objectContaining({
        priceCents: 5000,
        rateCardId: 'rate-card-1',
        routeId: 'route-1',
      }),
    );
    expect(result).toEqual({
      shipment_order_id: 'order-1',
      price_cents: 5000,
      expected_delivery_at: createdOrder.expectedDeliveryAt,
      status: ShipmentOrderStatus.CREATED,
    });
  });

  it('stores the authenticated creator on the new order', async () => {
    idempotencyStore.get.mockResolvedValue(null);
    pricing.getPrice.mockResolvedValue({
      rateCardId: 'rate-card-1',
      routeId: 'route-1',
      priceCents: 5000,
      slaExpectedDelivery: new Date('2026-07-15T00:00:00Z'),
    });
    repository.createOrder.mockResolvedValue({
      id: 'order-1',
      priceCents: 5000,
      expectedDeliveryAt: new Date('2026-07-15T00:00:00Z'),
      status: ShipmentOrderStatus.CREATED,
    } as ShipmentOrder);

    await service.createOrder(createOrderDto(), 'idem-key-9', 'user_abc');

    expect(repository.createOrder).toHaveBeenCalledWith(
      expect.objectContaining({ createdByUserId: 'user_abc' }),
    );
  });

  it('stores a null creator when no identity header is present', async () => {
    idempotencyStore.get.mockResolvedValue(null);
    pricing.getPrice.mockResolvedValue({
      rateCardId: 'rate-card-1',
      routeId: 'route-1',
      priceCents: 5000,
      slaExpectedDelivery: new Date('2026-07-15T00:00:00Z'),
    });
    repository.createOrder.mockResolvedValue({
      id: 'order-1',
      priceCents: 5000,
      expectedDeliveryAt: new Date('2026-07-15T00:00:00Z'),
      status: ShipmentOrderStatus.CREATED,
    } as ShipmentOrder);

    await service.createOrder(createOrderDto(), 'idem-key-10', null);

    expect(repository.createOrder).toHaveBeenCalledWith(
      expect.objectContaining({ createdByUserId: null }),
    );
  });

  describe('listOrders (ownership)', () => {
    const orderOfA = {
      id: 'order-a',
      priceCents: 5000,
      expectedDeliveryAt: new Date('2026-07-15T00:00:00Z'),
      status: ShipmentOrderStatus.CREATED,
      createdAt: new Date('2026-07-14T00:00:00Z'),
    } as ShipmentOrder;

    it('returns only the orders created by the requesting customer', async () => {
      repository.findByCreatedByUserId.mockResolvedValue([orderOfA]);

      const result = await service.listOrders('user-a', 'customer');

      expect(repository.findByCreatedByUserId).toHaveBeenCalledWith('user-a');
      expect(result).toEqual([
        {
          shipment_order_id: 'order-a',
          price_cents: 5000,
          expected_delivery_at: orderOfA.expectedDeliveryAt,
          status: ShipmentOrderStatus.CREATED,
          created_at: orderOfA.createdAt,
        },
      ]);
    });

    it('returns all orders for an admin', async () => {
      repository.findAll.mockResolvedValue([orderOfA]);

      await service.listOrders('admin-user', 'admin');

      expect(repository.findAll).toHaveBeenCalled();
      expect(repository.findByCreatedByUserId).not.toHaveBeenCalled();
    });

    it('returns an empty list when the caller has no user id', async () => {
      const result = await service.listOrders(null, 'customer');

      expect(result).toEqual([]);
      expect(repository.findByCreatedByUserId).not.toHaveBeenCalled();
      expect(repository.findAll).not.toHaveBeenCalled();
    });
  });

  it('throws 404 when Pricing has no matching rate card', async () => {
    idempotencyStore.get.mockResolvedValue(null);
    pricing.getPrice.mockResolvedValue(null);

    await expect(
      service.createOrder(createOrderDto(), 'idem-key-2'),
    ).rejects.toThrow(NotFoundException);
    expect(repository.createOrder).not.toHaveBeenCalled();
  });

  it('replays the cached response on a repeated Idempotency-Key without reprocessing', async () => {
    const cachedResponse = {
      shipment_order_id: 'order-cached',
      price_cents: 5000,
      expected_delivery_at: new Date('2026-07-15T00:00:00Z'),
      status: ShipmentOrderStatus.CREATED,
    };
    idempotencyStore.get.mockResolvedValue(cachedResponse);

    const result = await service.createOrder(createOrderDto(), 'idem-key-3');

    expect(result).toEqual(cachedResponse);
    expect(pricing.getPrice).not.toHaveBeenCalled();
    expect(repository.createOrder).not.toHaveBeenCalled();
  });

  it('caches the response after successfully creating an order', async () => {
    idempotencyStore.get.mockResolvedValue(null);
    pricing.getPrice.mockResolvedValue({
      rateCardId: 'rate-card-1',
      routeId: 'route-1',
      priceCents: 5000,
      slaExpectedDelivery: new Date('2026-07-15T00:00:00Z'),
    });
    repository.createOrder.mockResolvedValue({
      id: 'order-1',
      priceCents: 5000,
      expectedDeliveryAt: new Date('2026-07-15T00:00:00Z'),
      status: ShipmentOrderStatus.CREATED,
    } as ShipmentOrder);

    await service.createOrder(createOrderDto(), 'idem-key-4');

    expect(idempotencyStore.set).toHaveBeenCalledWith(
      expect.stringContaining('idem-key-4'),
      expect.objectContaining({ shipment_order_id: 'order-1' }),
      expect.any(Number),
    );
  });
});
