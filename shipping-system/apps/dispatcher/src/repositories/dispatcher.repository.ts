import { Injectable } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Not, Repository } from 'typeorm';
import { Driver } from '../entities/driver.entity';
import { Truck } from '../entities/truck.entity';
import { LinehaulTrip } from '../entities/linehaul-trip.entity';
import { Outbox } from '../entities/outbox.entity';
import {
  CourierAssignmentOutcome,
  IDispatcherRepository,
} from '../ports/dispatcher-repository.port';
import { OutboxEventInput } from '../ports/outbox-repository.port';

const TERMINAL_PARCEL_STATES = ['Delivered', 'Lost', 'Damaged'];

@Injectable()
export class DispatcherRepository implements IDispatcherRepository {
  constructor(
    @InjectRepository(LinehaulTrip)
    private readonly tripRepository: Repository<LinehaulTrip>,
    @InjectRepository(Driver)
    private readonly driverRepository: Repository<Driver>,
    @InjectRepository(Truck)
    private readonly truckRepository: Repository<Truck>,
    @InjectDataSource() private readonly dataSource: DataSource,
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

  async reserveCourierAssignment(
    parcelId: string,
    outboxEvent: OutboxEventInput,
  ): Promise<CourierAssignmentOutcome> {
    return this.dataSource.transaction(async (manager) => {
      // shipping_order_db and shipping_network_db are schemas of the same
      // physical database (ADR-003), so the lock and both reads below run
      // in one real transaction - it fully serializes concurrent assign
      // calls for the same parcel.
      await manager.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
        parcelId,
      ]);

      const parcelRows = await manager.query<Array<{ state: string }>>(
        'SELECT state FROM shipping_order_db.parcel WHERE id = $1',
        [parcelId],
      );
      const parcel = parcelRows[0];
      if (parcel && TERMINAL_PARCEL_STATES.includes(parcel.state)) {
        return 'parcel_terminal';
      }

      // The double-assign guard can't rely on PARCEL.assigned_courier_id:
      // that column is only ever updated asynchronously, once Order's
      // consumer processes this same event off the outbox, which can lag
      // well past two near-simultaneous assign calls (confirmed live -
      // both concurrent calls saw the same stale PARCEL row and both
      // proceeded). The OUTBOX row inserted below, in this schema, is the
      // one write Dispatcher itself makes synchronously, so it's the only
      // thing this transaction can check that the other transaction is
      // guaranteed to have already committed by the time the lock is
      // released.
      const existingAssignment = await manager.query<Array<{ id: string }>>(
        "SELECT id FROM shipping_network_db.outbox WHERE event_type = $1 AND payload->>'parcel_id' = $2 LIMIT 1",
        [outboxEvent.eventType, parcelId],
      );
      if (existingAssignment.length > 0) {
        return 'already_assigned';
      }

      await manager.save(Outbox, outboxEvent);
      return 'assigned';
    });
  }
}
