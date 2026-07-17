import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { CourierRole } from './courier-role.enum';

@Entity({ name: 'courier' })
export class Courier {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index('idx_courier_zone_id')
  @Column({ name: 'zone_id', type: 'uuid' })
  zoneId: string;

  // Clerk user id of the shipper account operating as this courier; null
  // until provisioned (scripts/link-courier-user.js).
  @Index('idx_courier_user_id', { unique: true })
  @Column({ name: 'user_id', type: 'varchar', length: 64, nullable: true })
  userId: string | null;

  @Column({ type: 'varchar', length: 50 })
  role: CourierRole;

  @Column({ type: 'varchar', length: 50, default: 'Active' })
  status: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
