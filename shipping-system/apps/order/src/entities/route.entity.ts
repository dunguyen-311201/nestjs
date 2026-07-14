import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

// Read-only mapping onto Hub/Sortation Service's ROUTE table
// (shipping_network_db). Order/Pricing only reads this to resolve the
// (origin_zone_id, dest_zone_id) corridor a new order's parcels travel,
// so PARCEL.route_id can be set at creation time; never writes to it.
@Entity({ name: 'route' })
export class Route {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'origin_zone_id', type: 'uuid' })
  originZoneId: string;

  @Column({ name: 'dest_zone_id', type: 'uuid' })
  destZoneId: string;
}
