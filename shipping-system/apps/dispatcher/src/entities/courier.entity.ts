import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'courier' })
export class Courier {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'zone_id', type: 'uuid' })
  zoneId: string;

  @Column({ type: 'varchar', length: 50 })
  role: string;

  @Column({ type: 'varchar', length: 50 })
  status: string;
}
