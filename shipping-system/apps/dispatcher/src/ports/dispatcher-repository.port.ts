import { Driver } from '../entities/driver.entity';
import { Truck } from '../entities/truck.entity';
import { LinehaulTrip } from '../entities/linehaul-trip.entity';

export abstract class IDispatcherRepository {
  abstract findTripById(id: string): Promise<LinehaulTrip | null>;
  abstract findDriverById(id: string): Promise<Driver | null>;
  abstract findTruckById(id: string): Promise<Truck | null>;
  abstract findOverlappingActiveTrip(
    driverId: string,
    truckId: string,
    excludeTripId: string,
  ): Promise<LinehaulTrip | null>;
  abstract assignDriverAndTruck(
    tripId: string,
    driverId: string,
    truckId: string,
  ): Promise<void>;
}
