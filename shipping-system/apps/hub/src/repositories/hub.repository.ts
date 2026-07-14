import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { Hub } from '../entities/hub.entity';
import { Route } from '../entities/route.entity';
import { Outbox } from '../entities/outbox.entity';
import {
  HubRecord,
  IHubRepository,
  OutboxEventInput,
  RouteRecord,
} from '../ports/hub-repository.port';

@Injectable()
export class HubRepository implements IHubRepository {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async findHubById(hubId: string): Promise<HubRecord | null> {
    return this.dataSource.getRepository(Hub).findOne({ where: { id: hubId } });
  }

  async findRouteById(routeId: string): Promise<RouteRecord | null> {
    return this.dataSource
      .getRepository(Route)
      .findOne({ where: { id: routeId } });
  }

  async findRouteByZones(
    originZoneId: string,
    destZoneId: string,
  ): Promise<RouteRecord | null> {
    return this.dataSource
      .getRepository(Route)
      .findOne({ where: { originZoneId, destZoneId } });
  }

  async recordScan(events: OutboxEventInput[]): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      for (const event of events) {
        await manager.save(Outbox, event);
      }
    });
  }
}
