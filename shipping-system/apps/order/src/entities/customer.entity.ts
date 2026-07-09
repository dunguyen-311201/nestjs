import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity({ name: 'customer' })
export class Customer {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'name_enc', type: 'varchar', length: 500 })
  nameEnc: string;

  @Column({ name: 'phone_enc', type: 'varchar', length: 500 })
  phoneEnc: string;

  @Column({ name: 'address_enc', type: 'varchar', length: 500 })
  addressEnc: string;

  @Column({ name: 'region_code', type: 'varchar', length: 50 })
  regionCode: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
