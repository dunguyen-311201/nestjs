import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'hub' })
export class Hub {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index('idx_hub_zone_id')
  @Column({ name: 'zone_id', type: 'uuid' })
  zoneId: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;
}
