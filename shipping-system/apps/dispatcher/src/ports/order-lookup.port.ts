import { Parcel } from '../entities/parcel.entity';

export abstract class IOrderLookupPort {
  abstract findParcelById(id: string): Promise<Parcel | null>;
}
