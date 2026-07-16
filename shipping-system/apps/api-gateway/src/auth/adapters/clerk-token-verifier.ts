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
    return { userId: payload.sub, sessionId: payload.sid };
  }
}
