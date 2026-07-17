import { isRole } from '@app/contracts';
import { verifyToken } from '@clerk/backend';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ITokenVerifier, VerifiedToken } from '../ports/token-verifier.port';

@Injectable()
export class ClerkTokenVerifier implements ITokenVerifier {
  constructor(private readonly configService: ConfigService) {}

  async verify(token: string): Promise<VerifiedToken> {
    const secretKey = this.configService.get<string>('CLERK_SECRET_KEY');
    if (!secretKey) {
      throw new UnauthorizedException('CLERK_SECRET_KEY is not configured');
    }
    const payload = await verifyToken(token, { secretKey });
    // 'role' is a custom claim mapped from publicMetadata.role via the Clerk
    // session-token customization; absent or unknown values become null so
    // authentication still succeeds (role enforcement rejects later).
    const role: unknown = (payload as Record<string, unknown>).role;
    // JWT-template tokens (used for long-lived test tokens) carry no sid;
    // only session tokens do.
    return {
      userId: payload.sub,
      sessionId: typeof payload.sid === 'string' ? payload.sid : null,
      role: isRole(role) ? role : null,
    };
  }
}
