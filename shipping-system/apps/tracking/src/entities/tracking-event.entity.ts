import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

export enum TrackingEventType {
  PICKUP = 'PICKUP',
  HUB_RECEIVE = 'HUB_RECEIVE',
  DEPARTED_LINEHAUL = 'DEPARTED_LINEHAUL',
  ARRIVED_AT_HUB = 'ARRIVED_AT_HUB',
  OUT_FOR_DELIVERY = 'OUT_FOR_DELIVERY',
  DELIVERY_FAILED = 'DELIVERY_FAILED',
  DELIVERED = 'DELIVERED',
  MISROUTED = 'MISROUTED',
  RTS = 'RTS',
}

// Append-only: this service never issues an UPDATE/DELETE against this
// table (BR-03), enforced at the DB role level, not just by omitting those
// TypeORM methods here.
@Entity({ name: 'tracking_event' })
export class TrackingEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'event_id', type: 'uuid', unique: true })
  eventId: string;

  @Column({ name: 'parcel_id', type: 'uuid' })
  parcelId: string;

  @Column({ name: 'hub_id', type: 'uuid', nullable: true })
  hubId: string | null;

  @Column({ name: 'courier_id', type: 'uuid', nullable: true })
  courierId: string | null;

  @Column({ name: 'linehaul_trip_id', type: 'uuid', nullable: true })
  linehaulTripId: string | null;

  @Column({ name: 'event_type', type: 'varchar', length: 50 })
  eventType: TrackingEventType;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
