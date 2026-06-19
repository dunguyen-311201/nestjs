import { UserRole } from '@app/shared';

export interface JwtPayload {
  sub: string;
  username: string;
  role: UserRole;
}
