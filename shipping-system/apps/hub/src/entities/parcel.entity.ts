import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

// Read-only mapping onto Order Service's PARCEL table (shipping_order_db).
// Hub reads this to resolve a parcel's parent order + current route for the
// hub-inbound guard and misrouted detection; never writes to it - the actual
// PARCEL.route_id/actual_weight_grams updates are applied by Order's own
// ParcelEventConsumer after consuming this service's published events.
@Entity({ name: 'parcel' })
export class Parcel {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'shipment_order_id', type: 'uuid' })
  shipmentOrderId: string;

  @Column({ name: 'route_id', type: 'uuid', nullable: true })
  routeId: string | null;
}
