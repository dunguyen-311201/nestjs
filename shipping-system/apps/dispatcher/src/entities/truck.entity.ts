import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'truck' })
export class Truck {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 50 })
  plate: string;
}
