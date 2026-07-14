import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { Hub } from '../entities/hub.entity';
import { LinehaulTrip } from '../entities/linehaul-trip.entity';
import { LinehaulTripStatus } from '../entities/linehaul-trip-status.enum';
import { Outbox } from '../entities/outbox.entity';
import {
  ILinehaulRepository,
  OutboxEventInput,
  TripRecord,
} from '../ports/linehaul-repository.port';

@Injectable()
export class LinehaulRepository implements ILinehaulRepository {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async findHubById(hubId: string): Promise<{ id: string } | null> {
    return this.dataSource.getRepository(Hub).findOne({ where: { id: hubId } });
  }

  async createTrip(
    originHubId: string,
    destHubId: string,
  ): Promise<{ id: string }> {
    const trip = await this.dataSource.getRepository(LinehaulTrip).save({
      originHubId,
      destHubId,
    });
    return { id: trip.id };
  }

  async findTripById(tripId: string): Promise<TripRecord | null> {
    return this.dataSource
      .getRepository(LinehaulTrip)
      .findOne({ where: { id: tripId } });
  }

  async markDeparted(
    tripId: string,
    outboxEvent: OutboxEventInput,
  ): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      await manager.update(LinehaulTrip, tripId, {
        status: LinehaulTripStatus.DEPARTED,
      });
      await manager.save(Outbox, outboxEvent);
    });
  }

  async markArrived(
    tripId: string,
    outboxEvent: OutboxEventInput,
  ): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      await manager.update(LinehaulTrip, tripId, {
        status: LinehaulTripStatus.ARRIVED,
      });
      await manager.save(Outbox, outboxEvent);
    });
  }
}
