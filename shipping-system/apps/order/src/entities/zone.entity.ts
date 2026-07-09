import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

// Read-only mapping onto Hub/Sortation Service's ZONE table
// (shipping_network_db). Order/Pricing only ever reads this to resolve
// region_code -> zone_id; never writes to it.
@Entity({ name: 'zone' })
export class Zone {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'region_code', type: 'varchar', length: 50 })
  regionCode: string;
}
