import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateOrderDto } from './dto/create-order.dto';
import { IOrderRepository } from './ports/order-repository.port';
import { IPricingPort } from './ports/pricing.port';
import { IIdempotencyStore } from './ports/idempotency-store.port';
import { ParcelDirection, ParcelState } from './entities/parcel.enums';
import { encrypt, hashForLookup } from '@app/crypto';

const IDEMPOTENCY_TTL_SECONDS = 24 * 60 * 60;

export interface CreateOrderResult {
  shipment_order_id: string;
  price_cents: number;
  expected_delivery_at: Date;
  status: string;
  share_token: string;
}

export interface OrderSummary {
  shipment_order_id: string;
  price_cents: number;
  expected_delivery_at: Date;
  status: string;
  created_at: Date;
}

@Injectable()
export class OrderService {
  constructor(
    private readonly orderRepository: IOrderRepository,
    private readonly pricingPort: IPricingPort,
    private readonly idempotencyStore: IIdempotencyStore,
  ) {}

  async listOrders(
    userId: string | null,
    role: string | null,
  ): Promise<OrderSummary[]> {
    let orders;
    if (role === 'admin') {
      orders = await this.orderRepository.findAll();
    } else if (userId) {
      orders = await this.orderRepository.findByCreatedByUserId(userId);
    } else {
      return [];
    }
    return orders.map((order) => ({
      shipment_order_id: order.id,
      price_cents: order.priceCents,
      expected_delivery_at: order.expectedDeliveryAt,
      status: order.status,
      created_at: order.createdAt,
    }));
  }

  async createOrder(
    dto: CreateOrderDto,
    idempotencyKey: string,
    createdByUserId: string | null = null,
  ): Promise<CreateOrderResult> {
    const cacheKey = `idem:order:${idempotencyKey}`;
    const cached = await this.idempotencyStore.get<CreateOrderResult>(cacheKey);
    if (cached) {
      return cached;
    }

    // A single order's parcels may mix types, and the pricing call is
    // per-type, so the order's locked price is the sum across parcels and
    // its ETA is the latest (worst-case) SLA among them.
    let totalPriceCents = 0;
    let rateCardId: string | undefined;
    let routeId: string | undefined;
    let expectedDeliveryAt: Date | undefined;

    for (const parcel of dto.parcels) {
      const quote = await this.pricingPort.getPrice(
        dto.sender.region_code,
        dto.recipient.region_code,
        parcel.type,
      );
      if (!quote) {
        throw new NotFoundException(
          'No matching rate card for this route/parcel type',
        );
      }
      totalPriceCents += quote.priceCents;
      rateCardId = quote.rateCardId;
      routeId = quote.routeId;
      if (
        !expectedDeliveryAt ||
        quote.slaExpectedDelivery > expectedDeliveryAt
      ) {
        expectedDeliveryAt = quote.slaExpectedDelivery;
      }
    }

    const order = await this.orderRepository.createOrder({
      sender: {
        nameEnc: encrypt(dto.sender.name),
        phoneEnc: encrypt(dto.sender.phone),
        phoneHash: hashForLookup(dto.sender.phone),
        addressEnc: encrypt(dto.sender.address),
        regionCode: dto.sender.region_code,
      },
      recipient: {
        nameEnc: encrypt(dto.recipient.name),
        phoneEnc: encrypt(dto.recipient.phone),
        phoneHash: hashForLookup(dto.recipient.phone),
        addressEnc: encrypt(dto.recipient.address),
        regionCode: dto.recipient.region_code,
      },
      rateCardId: rateCardId as string,
      routeId: routeId as string,
      priceCents: totalPriceCents,
      expectedDeliveryAt: expectedDeliveryAt as Date,
      paymentType: dto.payment_type,
      createdByUserId,
      parcels: dto.parcels.map((parcel) => ({
        declaredWeightGrams: parcel.declared_weight_grams,
        type: parcel.type,
        direction: ParcelDirection.FORWARD,
        state: ParcelState.CREATED,
      })),
    });

    const result: CreateOrderResult = {
      shipment_order_id: order.id,
      price_cents: order.priceCents,
      expected_delivery_at: order.expectedDeliveryAt,
      status: order.status,
      share_token: order.shareToken,
    };

    await this.idempotencyStore.set(cacheKey, result, IDEMPOTENCY_TTL_SECONDS);

    return result;
  }
}
