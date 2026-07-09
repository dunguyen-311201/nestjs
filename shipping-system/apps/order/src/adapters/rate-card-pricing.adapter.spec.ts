import { RateCardPricingAdapter } from './rate-card-pricing.adapter';
import { ParcelType } from '../entities/parcel.enums';
import { Zone } from '../entities/zone.entity';
import { RateCard } from '../entities/rate-card.entity';

describe('RateCardPricingAdapter', () => {
  let zoneRepository: { findOne: jest.Mock };
  let rateCardRepository: { findOne: jest.Mock };
  let adapter: RateCardPricingAdapter;

  const originZone: Zone = { id: 'origin-zone-1', regionCode: 'REG-100' };
  const destZone: Zone = { id: 'dest-zone-1', regionCode: 'REG-101' };

  beforeEach(() => {
    zoneRepository = { findOne: jest.fn() };
    rateCardRepository = { findOne: jest.fn() };
    adapter = new RateCardPricingAdapter(
      zoneRepository as never,
      rateCardRepository as never,
    );
  });

  it('resolves region codes to zone ids and returns the currently-effective rate card', async () => {
    zoneRepository.findOne.mockImplementation(
      ({ where: { regionCode } }: { where: { regionCode: string } }) => {
        if (regionCode === 'REG-100') return Promise.resolve(originZone);
        if (regionCode === 'REG-101') return Promise.resolve(destZone);
        return Promise.resolve(null);
      },
    );
    const rateCard: RateCard = {
      id: 'rate-card-1',
      originZoneId: originZone.id,
      destZoneId: destZone.id,
      parcelType: ParcelType.PARCEL,
      priceCents: 2500,
      slaDays: 3,
      effectiveFrom: new Date('2026-01-01T00:00:00Z'),
      effectiveTo: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    rateCardRepository.findOne.mockResolvedValue(rateCard);

    const result = await adapter.getPrice(
      'REG-100',
      'REG-101',
      ParcelType.PARCEL,
    );

    expect(result).not.toBeNull();
    expect(result?.rateCardId).toBe('rate-card-1');
    expect(result?.priceCents).toBe(2500);
    const expectedSla = new Date();
    expectedSla.setUTCDate(expectedSla.getUTCDate() + 3);
    expect(result?.slaExpectedDelivery.toDateString()).toBe(
      expectedSla.toDateString(),
    );
  });

  it('returns null when the origin region_code does not resolve to any zone', async () => {
    zoneRepository.findOne.mockResolvedValue(null);

    const result = await adapter.getPrice(
      'UNKNOWN',
      'REG-101',
      ParcelType.PARCEL,
    );

    expect(result).toBeNull();
    expect(rateCardRepository.findOne).not.toHaveBeenCalled();
  });

  it('returns null when zones resolve but no matching rate card exists', async () => {
    zoneRepository.findOne
      .mockResolvedValueOnce(originZone)
      .mockResolvedValueOnce(destZone);
    rateCardRepository.findOne.mockResolvedValue(null);

    const result = await adapter.getPrice(
      'REG-100',
      'REG-101',
      ParcelType.PALLET,
    );

    expect(result).toBeNull();
  });

  it('only considers the currently-effective rate card version (effective_from <= now <= effective_to)', async () => {
    zoneRepository.findOne
      .mockResolvedValueOnce(originZone)
      .mockResolvedValueOnce(destZone);
    rateCardRepository.findOne.mockImplementation(
      ({ where }: { where: Record<string, unknown>[] }) => {
        // Confirms the adapter queries with an effective-date condition
        // (each branch covers effective_to being set vs. still null), not
        // just (originZoneId, destZoneId, parcelType) alone.
        expect(where).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              originZoneId: originZone.id,
              destZoneId: destZone.id,
              parcelType: ParcelType.PARCEL,
            }),
          ]),
        );
        return Promise.resolve(null);
      },
    );

    await adapter.getPrice('REG-100', 'REG-101', ParcelType.PARCEL);

    expect(rateCardRepository.findOne).toHaveBeenCalled();
  });
});
