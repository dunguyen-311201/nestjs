import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

// No tracking_event_id column: this row is written synchronously by this
// service, before Tracking (async, cross-schema) has appended the
// corresponding DELIVERED TRACKING_EVENT row - parcel_id is the sole join
// key (see docs/lld/courier-service.md v1.1).
@Entity({ name: 'proof_of_delivery' })
export class ProofOfDelivery {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index('idx_proof_of_delivery_parcel_id')
  @Column({ name: 'parcel_id', type: 'uuid' })
  parcelId: string;

  @Column({
    name: 'signature_url',
    type: 'varchar',
    length: 500,
    nullable: true,
  })
  signatureUrl: string | null;

  @Column({ name: 'photo_url', type: 'varchar', length: 500, nullable: true })
  photoUrl: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
