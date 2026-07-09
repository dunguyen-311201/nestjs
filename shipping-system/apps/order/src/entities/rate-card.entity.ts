import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ParcelType } from './parcel.enums';

@Entity({ name: 'ratecard' })
export class RateCard {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index('idx_ratecard_origin_dest_zone')
  @Column({ name: 'origin_zone_id', type: 'uuid' })
  originZoneId: string;

  @Column({ name: 'dest_zone_id', type: 'uuid' })
  destZoneId: string;

  @Column({ name: 'parcel_type', type: 'varchar', length: 50 })
  parcelType: ParcelType;

  @Column({ name: 'price_cents', type: 'int' })
  priceCents: number;

  @Column({ name: 'sla_days', type: 'int' })
  slaDays: number;

  @Column({ name: 'effective_from', type: 'timestamp' })
  effectiveFrom: Date;

  @Column({ name: 'effective_to', type: 'timestamp', nullable: true })
  effectiveTo: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
