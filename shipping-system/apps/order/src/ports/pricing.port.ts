import { ParcelType } from '../entities/parcel.enums';

export interface PriceQuote {
  rateCardId: string;
  priceCents: number;
  slaExpectedDelivery: Date;
}

export abstract class IPricingPort {
  abstract getPrice(
    originRegionCode: string,
    destRegionCode: string,
    parcelType: ParcelType,
  ): Promise<PriceQuote | null>;
}
