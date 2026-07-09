import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateOrderDto } from './dto/create-order.dto';
import { IOrderRepository } from './ports/order-repository.port';
import { IPricingPort } from './ports/pricing.port';
import { IIdempotencyStore } from './ports/idempotency-store.port';
import { ParcelDirection, ParcelState } from './entities/parcel.enums';
import { encrypt } from '@app/crypto';

const IDEMPOTENCY_TTL_SECONDS = 24 * 60 * 60;

export interface CreateOrderResult {
  shipment_order_id: string;
  price_cents: number;
  expected_delivery_at: Date;
  status: string;
}

@Injectable()
export class OrderService {
  constructor(
    private readonly orderRepository: IOrderRepository,
    private readonly pricingPort: IPricingPort,
    private readonly idempotencyStore: IIdempotencyStore,
  ) {}

  async createOrder(
    dto: CreateOrderDto,
    idempotencyKey: string,
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
        addressEnc: encrypt(dto.sender.address),
        regionCode: dto.sender.region_code,
      },
      recipient: {
        nameEnc: encrypt(dto.recipient.name),
        phoneEnc: encrypt(dto.recipient.phone),
        addressEnc: encrypt(dto.recipient.address),
        regionCode: dto.recipient.region_code,
      },
      rateCardId: rateCardId as string,
      priceCents: totalPriceCents,
      expectedDeliveryAt: expectedDeliveryAt as Date,
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
    };

    await this.idempotencyStore.set(cacheKey, result, IDEMPOTENCY_TTL_SECONDS);

    return result;
  }
}
