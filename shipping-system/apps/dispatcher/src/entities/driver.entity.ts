import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'driver' })
export class Driver {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'name_enc', type: 'varchar', length: 500 })
  nameEnc: string;
}
