import { StockReservationStatus } from '#types'
import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm'

@Entity({ name: 'stock_reservation' })
export class StockReservation {
  @PrimaryGeneratedColumn()
  id: number

  @Column({ name: 'cart_id', type: 'int' })
  cartId: number

  @Column({ name: 'product_id', type: 'varchar' })
  productId: string

  @Column({ type: 'int' })
  quantity: number

  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt: Date

  @Column({ default: 'reserved', type: 'enum', enum: StockReservationStatus })
  status: StockReservationStatus

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date

  @Column({ name: 'invoice_id', type: 'varchar', nullable: true })
  invoiceId: string
}
