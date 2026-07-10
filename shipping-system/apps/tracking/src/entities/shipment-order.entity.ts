import { Entity, PrimaryGeneratedColumn } from 'typeorm';

// Read-only mapping onto Order Service's SHIPMENT_ORDER table
// (shipping_order_db). Tracking only ever reads this to confirm a
// tracking_id (shipment_order_id) exists before resolving its parcel ids;
// never writes to it.
@Entity({ name: 'shipment_order' })
export class ShipmentOrder {
  @PrimaryGeneratedColumn('uuid')
  id: string;
}
