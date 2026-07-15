import { Courier } from '../entities/courier.entity';

export abstract class ICourierLookupPort {
  abstract findCourierById(id: string): Promise<Courier | null>;
}
