export interface VerifiedToken {
  userId: string;
  sessionId: string;
}

export abstract class ITokenVerifier {
  abstract verify(token: string): Promise<VerifiedToken>;
}
