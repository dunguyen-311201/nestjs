import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

// Read-only mapping onto Order Service's PARCEL table (shipping_order_db).
// Courier reads this to resolve a parcel_id to its parent shipment_order_id
// for the pickup guard; never writes to it (PARCEL.state is advanced by
// Order's own parcel.* consumer after this service publishes an event).
@Entity({ name: 'parcel' })
export class Parcel {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'shipment_order_id', type: 'uuid' })
  shipmentOrderId: string;

  @Column({ type: 'varchar', length: 50 })
  direction: string;

  @Column({ name: 'assigned_courier_id', type: 'uuid', nullable: true })
  assignedCourierId: string | null;
}
