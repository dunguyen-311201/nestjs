import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ShipmentOrder } from './shipment-order.entity';
import { ParcelDirection, ParcelState, ParcelType } from './parcel.enums';

@Entity({ name: 'PARCEL' })
export class Parcel {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index('idx_parcel_shipment_order_id')
  @Column({ name: 'shipment_order_id', type: 'uuid' })
  shipmentOrderId: string;

  @ManyToOne(() => ShipmentOrder, (order) => order.parcels)
  @JoinColumn({ name: 'shipment_order_id' })
  shipmentOrder: ShipmentOrder;

  @Index('idx_parcel_route_id')
  @Column({ name: 'route_id', type: 'uuid', nullable: true })
  routeId: string | null;

  @Column({ name: 'declared_weight_grams', type: 'int' })
  declaredWeightGrams: number;

  @Column({ name: 'actual_weight_grams', type: 'int', nullable: true })
  actualWeightGrams: number | null;

  @Column({ type: 'varchar', length: 50 })
  type: ParcelType;

  @Column({ type: 'varchar', length: 50 })
  direction: ParcelDirection;

  @Column({ type: 'varchar', length: 50 })
  state: ParcelState;

  @Column({ name: 'sla_expected_delivery', type: 'timestamp', nullable: true })
  slaExpectedDelivery: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
