import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThanOrEqual, MoreThan, IsNull, Repository } from 'typeorm';
import { IPricingPort, PriceQuote } from '../ports/pricing.port';
import { ParcelType } from '../entities/parcel.enums';
import { Zone } from '../entities/zone.entity';
import { RateCard } from '../entities/rate-card.entity';

@Injectable()
export class RateCardPricingAdapter implements IPricingPort {
  constructor(
    @InjectRepository(Zone, 'network')
    private readonly zoneRepository: Repository<Zone>,
    @InjectRepository(RateCard, 'pricing')
    private readonly rateCardRepository: Repository<RateCard>,
  ) {}

  async getPrice(
    originRegionCode: string,
    destRegionCode: string,
    parcelType: ParcelType,
  ): Promise<PriceQuote | null> {
    const [originZone, destZone] = await Promise.all([
      this.zoneRepository.findOne({
        where: { regionCode: originRegionCode },
      }),
      this.zoneRepository.findOne({ where: { regionCode: destRegionCode } }),
    ]);
    if (!originZone || !destZone) {
      return null;
    }

    const now = new Date();
    const rateCard = await this.rateCardRepository.findOne({
      where: [
        {
          originZoneId: originZone.id,
          destZoneId: destZone.id,
          parcelType,
          effectiveFrom: LessThanOrEqual(now),
          effectiveTo: MoreThan(now),
        },
        {
          originZoneId: originZone.id,
          destZoneId: destZone.id,
          parcelType,
          effectiveFrom: LessThanOrEqual(now),
          effectiveTo: IsNull(),
        },
      ],
    });
    if (!rateCard) {
      return null;
    }

    const slaExpectedDelivery = new Date(now);
    slaExpectedDelivery.setUTCDate(
      slaExpectedDelivery.getUTCDate() + rateCard.slaDays,
    );

    return {
      rateCardId: rateCard.id,
      priceCents: rateCard.priceCents,
      slaExpectedDelivery,
    };
  }
}
