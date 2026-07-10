import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

// Read-only mapping onto Order Service's PARCEL table (shipping_order_db).
// Tracking only ever reads this to resolve a shipment_order_id to its
// parcel ids; never writes to it.
@Entity({ name: 'parcel' })
export class Parcel {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'shipment_order_id', type: 'uuid' })
  shipmentOrderId: string;

  @Column({ name: 'state', type: 'varchar', length: 50 })
  state: string;
}
