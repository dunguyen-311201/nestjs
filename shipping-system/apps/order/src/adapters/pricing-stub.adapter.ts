import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { IPricingPort, PriceQuote } from '../ports/pricing.port';
import { ParcelType } from '../entities/parcel.enums';

const STUB_PRICE_CENTS: Record<ParcelType, number> = {
  [ParcelType.PARCEL]: 5000,
  [ParcelType.PALLET]: 20000,
};

const STUB_SLA_DAYS = 3;

/**
 * Placeholder for the real RATECARD-backed lookup (rate-card row keyed by
 * origin/destination zone + parcel type). Returns a fixed price/SLA per
 * parcel type so Order Service's creation flow and tests aren't blocked
 * on Pricing's implementation.
 */
@Injectable()
export class PricingStubAdapter implements IPricingPort {
  getPrice(
    _originRegionCode: string,
    _destRegionCode: string,
    parcelType: ParcelType,
  ): Promise<PriceQuote | null> {
    const slaExpectedDelivery = new Date();
    slaExpectedDelivery.setUTCDate(
      slaExpectedDelivery.getUTCDate() + STUB_SLA_DAYS,
    );
    return Promise.resolve({
      rateCardId: randomUUID(),
      priceCents: STUB_PRICE_CENTS[parcelType],
      slaExpectedDelivery,
    });
  }
}
