import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TrackingController } from './tracking.controller';
import { TrackingService } from './tracking.service';
import { TrackingEvent } from './entities/tracking-event.entity';
import { ShipmentOrder } from './entities/shipment-order.entity';
import { Parcel } from './entities/parcel.entity';
import { ITrackingEventRepository } from './ports/tracking-event-repository.port';
import { TrackingEventRepository } from './repositories/tracking-event.repository';
import { IOrderLookupPort } from './ports/order-lookup.port';
import { OrderLookupAdapter } from './adapters/order-lookup.adapter';
import { TrackingEventConsumer } from './nats/tracking-event.consumer';

@Module({
  imports: [
    TypeOrmModule.forFeature([TrackingEvent]),
    TypeOrmModule.forFeature([ShipmentOrder, Parcel], 'order'),
  ],
  controllers: [TrackingController],
  providers: [
    TrackingService,
    { provide: ITrackingEventRepository, useClass: TrackingEventRepository },
    { provide: IOrderLookupPort, useClass: OrderLookupAdapter },
    TrackingEventConsumer,
  ],
})
export class TrackingModule {}
