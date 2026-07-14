import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'route' })
export class Route {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'origin_zone_id', type: 'uuid' })
  originZoneId: string;

  @Column({ name: 'dest_zone_id', type: 'uuid' })
  destZoneId: string;
}
