import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

// Read-only mapping onto Order Service's SHIPMENT_ORDER table
// (shipping_order_db). Courier only reads this to enforce the paid-order
// dispatch guard (pickup blocked until the parent order is Confirmed+);
// never writes to it.
@Entity({ name: 'shipment_order' })
export class ShipmentOrder {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 50 })
  status: string;
}
