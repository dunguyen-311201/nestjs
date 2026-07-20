import {
  Column,
  CreateDateColumn,
  Entity,
  Generated,
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

@Entity({ name: 'shipment_order' })
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

  // Clerk user id of the authenticated creator (from the gateway-verified
  // x-user-id header). Null for orders created before auth existed - those
  // are visible to admins only.
  @Index('idx_shipment_order_created_by_user_id')
  @Column({
    name: 'created_by_user_id',
    type: 'varchar',
    length: 64,
    nullable: true,
  })
  createdByUserId: string | null;

  @Column({ name: 'expected_delivery_at', type: 'timestamp' })
  expectedDeliveryAt: Date;

  @Index('idx_shipment_order_status')
  @Column({ type: 'varchar', length: 50 })
  status: ShipmentOrderStatus;

  // DB-generated (gen_random_uuid() default) - never set by the app.
  // @Generated tells TypeORM to read the value back via INSERT...RETURNING,
  // same as the id column, instead of it staying undefined post-save.
  @Index('idx_shipment_order_share_token', { unique: true })
  @Generated('uuid')
  @Column({ name: 'share_token', type: 'uuid' })
  shareToken: string;

  @OneToMany(() => Parcel, (parcel) => parcel.shipmentOrder)
  parcels: Parcel[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
