import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { DeliveryAttemptOutcome } from './delivery-attempt-outcome.enum';

@Entity({ name: 'delivery_attempt' })
export class DeliveryAttempt {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index('idx_delivery_attempt_parcel_id')
  @Column({ name: 'parcel_id', type: 'uuid' })
  parcelId: string;

  @Column({ type: 'varchar', length: 50, default: 'Forward' })
  direction: string;

  @Column({ name: 'attempt_number', type: 'int' })
  attemptNumber: number;

  @Column({ type: 'varchar', length: 50 })
  outcome: DeliveryAttemptOutcome;

  @Column({
    name: 'failure_reason',
    type: 'varchar',
    length: 500,
    nullable: true,
  })
  failureReason: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
