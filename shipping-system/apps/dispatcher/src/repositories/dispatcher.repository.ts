import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Not, Repository } from 'typeorm';
import { Driver } from '../entities/driver.entity';
import { Truck } from '../entities/truck.entity';
import { LinehaulTrip } from '../entities/linehaul-trip.entity';
import { IDispatcherRepository } from '../ports/dispatcher-repository.port';

@Injectable()
export class DispatcherRepository implements IDispatcherRepository {
  constructor(
    @InjectRepository(LinehaulTrip)
    private readonly tripRepository: Repository<LinehaulTrip>,
    @InjectRepository(Driver)
    private readonly driverRepository: Repository<Driver>,
    @InjectRepository(Truck)
    private readonly truckRepository: Repository<Truck>,
  ) {}

  async findTripById(id: string): Promise<LinehaulTrip | null> {
    return this.tripRepository.findOne({ where: { id } });
  }

  async findDriverById(id: string): Promise<Driver | null> {
    return this.driverRepository.findOne({ where: { id } });
  }

  async findTruckById(id: string): Promise<Truck | null> {
    return this.truckRepository.findOne({ where: { id } });
  }

  async findOverlappingActiveTrip(
    driverId: string,
    truckId: string,
    excludeTripId: string,
  ): Promise<LinehaulTrip | null> {
    // Check if driver or truck is already assigned to a trip in status 'Created' or 'Departed'
    return this.tripRepository.findOne({
      where: [
        {
          id: Not(excludeTripId),
          driverId,
          status: Not('Arrived'),
        },
        {
          id: Not(excludeTripId),
          truckId,
          status: Not('Arrived'),
        },
      ],
    });
  }

  async assignDriverAndTruck(
    tripId: string,
    driverId: string,
    truckId: string,
  ): Promise<void> {
    await this.tripRepository.update(tripId, { driverId, truckId });
  }
}
