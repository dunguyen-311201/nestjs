import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

export enum OutboxStatus {
  PENDING = 'PENDING',
  PUBLISHED = 'PUBLISHED',
}

// Maps onto the same physical shipping_network_db.outbox table Hub Service
// already created - Dispatcher shares this schema with Hub and Line-haul
// by the original data-ownership split, same precedent as Line-haul's own
// Outbox entity.
@Entity({ name: 'outbox' })
export class Outbox {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'event_id', type: 'uuid', unique: true })
  eventId: string;

  @Column({ name: 'event_type', type: 'varchar', length: 100 })
  eventType: string;

  @Column({ name: 'payload', type: 'jsonb' })
  payload: Record<string, unknown>;

  @Column({
    name: 'status',
    type: 'varchar',
    length: 20,
    default: OutboxStatus.PENDING,
  })
  status: OutboxStatus;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @Column({ name: 'published_at', type: 'timestamp', nullable: true })
  publishedAt: Date | null;
}
