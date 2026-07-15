import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'linehaultrip' })
export class LinehaulTrip {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'driver_id', type: 'uuid', nullable: true })
  driverId: string | null;

  @Column({ name: 'truck_id', type: 'uuid', nullable: true })
  truckId: string | null;

  @Column({ type: 'varchar', length: 50 })
  status: string;
}
