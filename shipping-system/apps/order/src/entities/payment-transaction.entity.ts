import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity({ name: 'payment_transaction' })
export class PaymentTransaction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'payment_id', type: 'uuid' })
  paymentId: string;

  @Column({ name: 'provider', type: 'varchar', length: 50 })
  provider: string;

  @Column({
    name: 'external_transaction_id',
    type: 'varchar',
    length: 255,
    unique: true,
  })
  externalTransactionId: string;

  @Column({
    name: 'external_reference_id',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  externalReferenceId: string | null;

  @Column({ name: 'status', type: 'varchar', length: 50 })
  status: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
