import { Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'parcel' })
export class Parcel {
  @PrimaryGeneratedColumn('uuid')
  id: string;
}
