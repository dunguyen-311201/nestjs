/* eslint-disable @typescript-eslint/unbound-method -- jest.fn() mocks flagged as false positives */
import {
  BadRequestException,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { NATS_SUBJECTS } from '@app/contracts';
import { LinehaulService } from './linehaul.service';
import { ILinehaulRepository } from './ports/linehaul-repository.port';
import { IIdempotencyStore } from './ports/idempotency-store.port';
import { LinehaulTripStatus } from './entities/linehaul-trip-status.enum';

describe('LinehaulService', () => {
  let linehaulRepository: jest.Mocked<ILinehaulRepository>;
  let idempotencyStore: jest.Mocked<IIdempotencyStore>;
  let service: LinehaulService;

  beforeEach(() => {
    linehaulRepository = {
      findHubById: jest.fn(),
      createTrip: jest.fn(),
      findTripById: jest.fn(),
      markDeparted: jest.fn().mockResolvedValue(undefined),
      markArrived: jest.fn().mockResolvedValue(undefined),
    };
    idempotencyStore = { get: jest.fn(), set: jest.fn() };
    idempotencyStore.get.mockResolvedValue(null);
    service = new LinehaulService(linehaulRepository, idempotencyStore);
  });

  describe('createTrip', () => {
    it('throws 404 when the origin hub does not exist', async () => {
      linehaulRepository.findHubById.mockResolvedValueOnce(null);

      await expect(
        service.createTrip(
          { origin_hub_id: 'hub-1', dest_hub_id: 'hub-2' },
          'idem-1',
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws 404 when the dest hub does not exist', async () => {
      linehaulRepository.findHubById
        .mockResolvedValueOnce({ id: 'hub-1' })
        .mockResolvedValueOnce(null);

      await expect(
        service.createTrip(
          { origin_hub_id: 'hub-1', dest_hub_id: 'hub-2' },
          'idem-1',
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws 400 when origin_hub_id equals dest_hub_id', async () => {
      await expect(
        service.createTrip(
          { origin_hub_id: 'hub-1', dest_hub_id: 'hub-1' },
          'idem-1',
        ),
      ).rejects.toThrow(BadRequestException);
      expect(linehaulRepository.findHubById).not.toHaveBeenCalled();
    });

    it('creates the trip and returns trip_id when both hubs exist', async () => {
      linehaulRepository.findHubById
        .mockResolvedValueOnce({ id: 'hub-1' })
        .mockResolvedValueOnce({ id: 'hub-2' });
      linehaulRepository.createTrip.mockResolvedValue({ id: 'trip-1' });

      const result = await service.createTrip(
        { origin_hub_id: 'hub-1', dest_hub_id: 'hub-2' },
        'idem-1',
      );

      expect(result).toEqual({ trip_id: 'trip-1' });
      expect(linehaulRepository.createTrip).toHaveBeenCalledWith(
        'hub-1',
        'hub-2',
        [],
      );
    });

    it('passes parcel_ids through to the repository when provided', async () => {
      linehaulRepository.findHubById
        .mockResolvedValueOnce({ id: 'hub-1' })
        .mockResolvedValueOnce({ id: 'hub-2' });
      linehaulRepository.createTrip.mockResolvedValue({ id: 'trip-1' });

      await service.createTrip(
        {
          origin_hub_id: 'hub-1',
          dest_hub_id: 'hub-2',
          parcel_ids: ['parcel-1', 'parcel-2'],
        },
        'idem-1',
      );

      expect(linehaulRepository.createTrip).toHaveBeenCalledWith(
        'hub-1',
        'hub-2',
        ['parcel-1', 'parcel-2'],
      );
    });

    it('replays the cached response on a repeated Idempotency-Key', async () => {
      const cached = { trip_id: 'trip-cached' };
      idempotencyStore.get.mockResolvedValue(cached);

      const result = await service.createTrip(
        { origin_hub_id: 'hub-1', dest_hub_id: 'hub-2' },
        'idem-1',
      );

      expect(result).toBe(cached);
      expect(linehaulRepository.findHubById).not.toHaveBeenCalled();
    });
  });

  describe('depart', () => {
    it('throws 404 when the trip does not exist', async () => {
      linehaulRepository.findTripById.mockResolvedValue(null);

      await expect(service.depart('trip-1', 'idem-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws 409 when the trip is not in Created status', async () => {
      linehaulRepository.findTripById.mockResolvedValue({
        id: 'trip-1',
        status: LinehaulTripStatus.DEPARTED,
      });

      await expect(service.depart('trip-1', 'idem-1')).rejects.toThrow(
        ConflictException,
      );
      expect(linehaulRepository.markDeparted).not.toHaveBeenCalled();
    });

    it('marks the trip Departed and writes a trip.departed OUTBOX row', async () => {
      linehaulRepository.findTripById.mockResolvedValue({
        id: 'trip-1',
        status: LinehaulTripStatus.CREATED,
        parcelIds: [],
      });

      const result = await service.depart('trip-1', 'idem-1');

      expect(result).toEqual({ status: 'recorded' });
      expect(linehaulRepository.markDeparted).toHaveBeenCalledWith('trip-1', [
        expect.objectContaining({
          eventType: NATS_SUBJECTS.TRIP_DEPARTED,
          payload: expect.objectContaining({
            linehaul_trip_id: 'trip-1',
          }) as unknown,
        }),
      ]);
    });

    it('also publishes one parcel.loaded_for_linehaul event per parcel on the trip', async () => {
      linehaulRepository.findTripById.mockResolvedValue({
        id: 'trip-1',
        status: LinehaulTripStatus.CREATED,
        parcelIds: ['parcel-1', 'parcel-2'],
      });

      await service.depart('trip-1', 'idem-1');

      expect(linehaulRepository.markDeparted).toHaveBeenCalledWith('trip-1', [
        expect.objectContaining({ eventType: NATS_SUBJECTS.TRIP_DEPARTED }),
        expect.objectContaining({
          eventType: NATS_SUBJECTS.PARCEL_LOADED_FOR_LINEHAUL,
          payload: expect.objectContaining({
            parcel_id: 'parcel-1',
            linehaul_trip_id: 'trip-1',
          }) as unknown,
        }),
        expect.objectContaining({
          eventType: NATS_SUBJECTS.PARCEL_LOADED_FOR_LINEHAUL,
          payload: expect.objectContaining({
            parcel_id: 'parcel-2',
            linehaul_trip_id: 'trip-1',
          }) as unknown,
        }),
      ]);
    });

    it('replays the cached response on a repeated Idempotency-Key', async () => {
      const cached = { status: 'recorded' };
      idempotencyStore.get.mockResolvedValue(cached);

      const result = await service.depart('trip-1', 'idem-1');

      expect(result).toBe(cached);
      expect(linehaulRepository.findTripById).not.toHaveBeenCalled();
    });
  });

  describe('arrive', () => {
    it('throws 404 when the trip does not exist', async () => {
      linehaulRepository.findTripById.mockResolvedValue(null);

      await expect(service.arrive('trip-1', 'idem-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws 409 when the trip has not departed yet', async () => {
      linehaulRepository.findTripById.mockResolvedValue({
        id: 'trip-1',
        status: LinehaulTripStatus.CREATED,
      });

      await expect(service.arrive('trip-1', 'idem-1')).rejects.toThrow(
        ConflictException,
      );
      expect(linehaulRepository.markArrived).not.toHaveBeenCalled();
    });

    it('throws 409 when the trip has already arrived', async () => {
      linehaulRepository.findTripById.mockResolvedValue({
        id: 'trip-1',
        status: LinehaulTripStatus.ARRIVED,
      });

      await expect(service.arrive('trip-1', 'idem-1')).rejects.toThrow(
        ConflictException,
      );
    });

    it('marks the trip Arrived and writes an OUTBOX row', async () => {
      linehaulRepository.findTripById.mockResolvedValue({
        id: 'trip-1',
        status: LinehaulTripStatus.DEPARTED,
      });

      const result = await service.arrive('trip-1', 'idem-1');

      expect(result).toEqual({ status: 'recorded' });
      expect(linehaulRepository.markArrived).toHaveBeenCalledWith(
        'trip-1',
        expect.objectContaining({
          eventType: NATS_SUBJECTS.TRIP_ARRIVED,
          payload: expect.objectContaining({
            linehaul_trip_id: 'trip-1',
          }) as unknown,
        }),
      );
    });
  });
});
