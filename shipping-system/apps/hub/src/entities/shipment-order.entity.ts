import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

// Read-only mapping onto Order Service's SHIPMENT_ORDER table
// (shipping_order_db). Hub only reads this to enforce the hub-inbound
// guard (blocked until the parent order is Confirmed+); never writes to it.
@Entity({ name: 'shipment_order' })
export class ShipmentOrder {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 50 })
  status: string;
}
