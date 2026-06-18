import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

export enum ReservationStatus {
  PENDING = 'PENDING',
  COMMITTED = 'COMMITTED',
  RELEASED = 'RELEASED',
}

@Entity()
export class Reservation {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  orderId!: string;

  @Column()
  productId!: string;

  @Column('int')
  quantity!: number;

  @Column({ type: 'varchar', default: ReservationStatus.PENDING })
  status!: ReservationStatus;

  @CreateDateColumn()
  createdAt!: Date;
}
