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

  // Deterministic HMAC-SHA256(phone) - phone_enc's random IV makes it
  // unusable for equality lookups, so this is kept alongside it purely to
  // find an existing customer by phone without decrypting every row.
  @Column({ name: 'phone_hash', type: 'varchar', length: 64 })
  phoneHash: string;

  @Column({ name: 'address_enc', type: 'varchar', length: 500 })
  addressEnc: string;

  @Column({ name: 'region_code', type: 'varchar', length: 50 })
  regionCode: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
