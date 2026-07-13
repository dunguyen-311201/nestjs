import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { PaymentStatus } from './payment-status.enum';

export enum PaymentType {
  PREPAID_STRIPE = 'PREPAID_STRIPE',
}

@Entity({ name: 'payment' })
export class Payment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'shipment_order_id', type: 'uuid' })
  shipmentOrderId: string;

  @Column({ name: 'type', type: 'varchar', length: 50 })
  type: PaymentType;

  @Column({ name: 'amount_cents', type: 'int' })
  amountCents: number;

  @Column({ name: 'status', type: 'varchar', length: 50 })
  status: PaymentStatus;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
