/* eslint-disable @typescript-eslint/unbound-method -- jest.fn() mocks flagged as false positives */
import {
  ConflictException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { DispatcherService } from './dispatcher.service';
import { IDispatcherRepository } from './ports/dispatcher-repository.port';
import { ICourierLookupPort } from './ports/courier-lookup.port';
import { IOrderLookupPort } from './ports/order-lookup.port';
import { IIdempotencyStore } from './ports/idempotency-store.port';
import { Courier } from './entities/courier.entity';
import { Parcel } from './entities/parcel.entity';
import { LinehaulTrip } from './entities/linehaul-trip.entity';
import { Driver } from './entities/driver.entity';
import { Truck } from './entities/truck.entity';

describe('DispatcherService', () => {
  let dispatcherRepository: jest.Mocked<IDispatcherRepository>;
  let courierLookup: jest.Mocked<ICourierLookupPort>;
  let orderLookup: jest.Mocked<IOrderLookupPort>;
  let idempotencyStore: jest.Mocked<IIdempotencyStore>;
  let service: DispatcherService;

  beforeEach(() => {
    dispatcherRepository = {
      findTripById: jest.fn(),
      findDriverById: jest.fn(),
      findTruckById: jest.fn(),
      findOverlappingActiveTrip: jest.fn(),
      assignDriverAndTruck: jest.fn(),
    };
    courierLookup = {
      findCourierById: jest.fn(),
    };
    orderLookup = {
      findParcelById: jest.fn(),
    };
    idempotencyStore = {
      get: jest.fn(),
      set: jest.fn(),
    };
    idempotencyStore.get.mockResolvedValue(null);

    service = new DispatcherService(
      dispatcherRepository,
      courierLookup,
      orderLookup,
      idempotencyStore,
    );
  });

  describe('assignTrip', () => {
    const tripId = 'trip-1';
    const driverId = 'driver-1';
    const truckId = 'truck-1';
    const dto = { driver_id: driverId, truck_id: truckId };
    const idemKey = 'idem-key';

    it('throws 404 when the trip does not exist', async () => {
      dispatcherRepository.findTripById.mockResolvedValueOnce(null);

      await expect(service.assignTrip(tripId, dto, idemKey)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws 404 when the driver does not exist', async () => {
      dispatcherRepository.findTripById.mockResolvedValueOnce(
        {} as LinehaulTrip,
      );
      dispatcherRepository.findDriverById.mockResolvedValueOnce(null);

      await expect(service.assignTrip(tripId, dto, idemKey)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws 404 when the truck does not exist', async () => {
      dispatcherRepository.findTripById.mockResolvedValueOnce(
        {} as LinehaulTrip,
      );
      dispatcherRepository.findDriverById.mockResolvedValueOnce({} as Driver);
      dispatcherRepository.findTruckById.mockResolvedValueOnce(null);

      await expect(service.assignTrip(tripId, dto, idemKey)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws 409 when driver or truck is already assigned to an overlapping active trip', async () => {
      dispatcherRepository.findTripById.mockResolvedValueOnce(
        {} as LinehaulTrip,
      );
      dispatcherRepository.findDriverById.mockResolvedValueOnce({} as Driver);
      dispatcherRepository.findTruckById.mockResolvedValueOnce({} as Truck);
      dispatcherRepository.findOverlappingActiveTrip.mockResolvedValueOnce(
        {} as LinehaulTrip,
      );

      await expect(service.assignTrip(tripId, dto, idemKey)).rejects.toThrow(
        ConflictException,
      );
    });

    it('successfully assigns driver and truck to trip', async () => {
      dispatcherRepository.findTripById.mockResolvedValueOnce(
        {} as LinehaulTrip,
      );
      dispatcherRepository.findDriverById.mockResolvedValueOnce({} as Driver);
      dispatcherRepository.findTruckById.mockResolvedValueOnce({} as Truck);
      dispatcherRepository.findOverlappingActiveTrip.mockResolvedValueOnce(
        null,
      );

      const result = await service.assignTrip(tripId, dto, idemKey);

      expect(result).toEqual({ status: 'recorded' });
      expect(dispatcherRepository.assignDriverAndTruck).toHaveBeenCalledWith(
        tripId,
        driverId,
        truckId,
      );
      expect(idempotencyStore.set).toHaveBeenCalledWith(
        `idem:dispatcher:${idemKey}`,
        { status: 'recorded' },
        24 * 60 * 60,
      );
    });

    it('returns cached result on idempotent replay', async () => {
      idempotencyStore.get.mockResolvedValueOnce({ status: 'recorded' });

      const result = await service.assignTrip(tripId, dto, idemKey);

      expect(result).toEqual({ status: 'recorded' });
      expect(dispatcherRepository.findTripById).not.toHaveBeenCalled();
    });
  });

  describe('assignLeg', () => {
    const parcelId = 'parcel-1';
    const courierId = 'courier-1';
    const dto = { courier_id: courierId };
    const idemKey = 'idem-key';

    it('throws 404 when the leg/parcel does not exist', async () => {
      orderLookup.findParcelById.mockResolvedValueOnce(null);

      await expect(service.assignLeg(parcelId, dto, idemKey)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws 404 when the courier does not exist', async () => {
      orderLookup.findParcelById.mockResolvedValueOnce({} as Parcel);
      courierLookup.findCourierById.mockResolvedValueOnce(null);

      await expect(service.assignLeg(parcelId, dto, idemKey)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws 422 when the courier is not active/verified', async () => {
      orderLookup.findParcelById.mockResolvedValueOnce({} as Parcel);
      courierLookup.findCourierById.mockResolvedValueOnce({
        status: 'Inactive',
      } as Courier);

      await expect(service.assignLeg(parcelId, dto, idemKey)).rejects.toThrow(
        UnprocessableEntityException,
      );
    });

    it('successfully validates and returns recorded status (active courier)', async () => {
      orderLookup.findParcelById.mockResolvedValueOnce({} as Parcel);
      courierLookup.findCourierById.mockResolvedValueOnce({
        status: 'Active',
      } as Courier);

      const result = await service.assignLeg(parcelId, dto, idemKey);

      expect(result).toEqual({ status: 'recorded' });
      expect(idempotencyStore.set).toHaveBeenCalledWith(
        `idem:dispatcher:${idemKey}`,
        { status: 'recorded' },
        24 * 60 * 60,
      );
    });

    it('successfully validates and returns recorded status (verified courier)', async () => {
      orderLookup.findParcelById.mockResolvedValueOnce({} as Parcel);
      courierLookup.findCourierById.mockResolvedValueOnce({
        status: 'Verified',
      } as Courier);

      const result = await service.assignLeg(parcelId, dto, idemKey);

      expect(result).toEqual({ status: 'recorded' });
    });

    it('returns cached result on idempotent replay', async () => {
      idempotencyStore.get.mockResolvedValueOnce({ status: 'recorded' });

      const result = await service.assignLeg(parcelId, dto, idemKey);

      expect(result).toEqual({ status: 'recorded' });
      expect(orderLookup.findParcelById).not.toHaveBeenCalled();
    });
  });
});
