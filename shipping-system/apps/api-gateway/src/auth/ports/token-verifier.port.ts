import { Role } from '@app/contracts';

export interface VerifiedToken {
  userId: string;
  sessionId: string;
  role: Role | null;
}

export abstract class ITokenVerifier {
  abstract verify(token: string): Promise<VerifiedToken>;
}
