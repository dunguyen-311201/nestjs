import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Customer } from './customer.entity';
import { Parcel } from './parcel.entity';
import { ShipmentOrderStatus } from './shipment-order-status.enum';

@Entity({ name: 'SHIPMENT_ORDER' })
export class ShipmentOrder {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index('idx_shipment_order_sender_id')
  @Column({ name: 'sender_id', type: 'uuid' })
  senderId: string;

  @ManyToOne(() => Customer)
  @JoinColumn({ name: 'sender_id' })
  sender: Customer;

  @Index('idx_shipment_order_recipient_id')
  @Column({ name: 'recipient_id', type: 'uuid' })
  recipientId: string;

  @ManyToOne(() => Customer)
  @JoinColumn({ name: 'recipient_id' })
  recipient: Customer;

  @Index('idx_shipment_order_rate_card_id')
  @Column({ name: 'rate_card_id', type: 'uuid' })
  rateCardId: string;

  @Column({ name: 'price_cents', type: 'int' })
  priceCents: number;

  @Column({ name: 'expected_delivery_at', type: 'timestamp' })
  expectedDeliveryAt: Date;

  @Index('idx_shipment_order_status')
  @Column({ type: 'varchar', length: 50 })
  status: ShipmentOrderStatus;

  @OneToMany(() => Parcel, (parcel) => parcel.shipmentOrder)
  parcels: Parcel[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
