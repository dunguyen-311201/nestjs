import { NotFoundException } from '@nestjs/common';
import { OrderController } from './order.controller';
import { OrderService } from './order.service';
import { PaymentService } from './payment.service';
import { CreateOrderDto, PaymentType } from './dto/create-order.dto';
import { ParcelType } from './entities/parcel.enums';
import { ShipmentOrderStatus } from './entities/shipment-order-status.enum';
import { IPricingPort } from './ports/pricing.port';

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

describe('OrderController', () => {
  let orderService: jest.Mocked<Pick<OrderService, 'createOrder'>>;
  let pricingPort: jest.Mocked<IPricingPort>;
  let paymentService: jest.Mocked<Pick<PaymentService, 'checkout'>>;
  let controller: OrderController;

  beforeEach(() => {
    orderService = { createOrder: jest.fn() };
    pricingPort = { getPrice: jest.fn() };
    paymentService = { checkout: jest.fn() };
    controller = new OrderController(
      orderService as unknown as OrderService,
      pricingPort,
      paymentService as unknown as PaymentService,
    );
  });

  describe('POST /orders', () => {
    it('delegates to OrderService.createOrder with the Idempotency-Key', async () => {
      const expected = {
        shipment_order_id: 'order-1',
        price_cents: 5000,
        expected_delivery_at: new Date('2026-07-15T00:00:00Z'),
        status: ShipmentOrderStatus.CREATED,
      };
      orderService.createOrder.mockResolvedValue(expected);

      const result = await controller.create(createOrderDto(), 'idem-key-1');

      expect(orderService.createOrder).toHaveBeenCalledWith(
        createOrderDto(),
        'idem-key-1',
      );
      expect(result).toEqual(expected);
    });
  });

  describe('GET /orders/:id/quote', () => {
    it('returns price_cents and sla_expected_delivery from Pricing', async () => {
      const sla = new Date('2026-07-15T00:00:00Z');
      pricingPort.getPrice.mockResolvedValue({
        rateCardId: 'rate-card-1',
        priceCents: 5000,
        slaExpectedDelivery: sla,
      });

      const result = await controller.quote('HN01', 'SG01', ParcelType.PARCEL);

      expect(result).toEqual({
        price_cents: 5000,
        sla_expected_delivery: sla,
      });
    });

    it('throws 404 when Pricing has no matching rate card', async () => {
      pricingPort.getPrice.mockResolvedValue(null);

      await expect(
        controller.quote('HN01', 'SG01', ParcelType.PARCEL),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('POST /orders/:id/checkout', () => {
    it('delegates to PaymentService.checkout', async () => {
      const expected = {
        checkout_url: 'https://checkout.stripe.com/cs_1',
        stripe_session_id: 'cs_1',
      };
      paymentService.checkout.mockResolvedValue(expected);

      const result = await controller.checkout('order-1');

      expect(paymentService.checkout).toHaveBeenCalledWith('order-1');
      expect(result).toEqual(expected);
    });
  });
});
