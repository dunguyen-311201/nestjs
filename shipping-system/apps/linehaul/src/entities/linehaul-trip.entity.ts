import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { LinehaulTripStatus } from './linehaul-trip-status.enum';

@Entity({ name: 'linehaultrip' })
export class LinehaulTrip {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index('idx_trip_origin_hub')
  @Column({ name: 'origin_hub_id', type: 'uuid' })
  originHubId: string;

  @Index('idx_trip_dest_hub')
  @Column({ name: 'dest_hub_id', type: 'uuid' })
  destHubId: string;

  @Column({ name: 'driver_id', type: 'uuid', nullable: true })
  driverId: string | null;

  @Column({ name: 'truck_id', type: 'uuid', nullable: true })
  truckId: string | null;

  @Column({
    type: 'varchar',
    length: 50,
    default: LinehaulTripStatus.CREATED,
  })
  status: LinehaulTripStatus;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
