import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

// Read-only mapping onto Order Service's SHIPMENT_ORDER table
// (shipping_order_db). Tracking only ever reads this to confirm a
// tracking_id (shipment_order_id) exists before resolving its parcel ids;
// never writes to it.
@Entity({ name: 'shipment_order' })
export class ShipmentOrder {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'share_token', type: 'uuid' })
  shareToken: string;

  @Column({ name: 'expected_delivery_at', type: 'timestamp' })
  expectedDeliveryAt: Date;
}
