import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { ITokenVerifier, VerifiedToken } from './ports/token-verifier.port';
import { ROUTE_ACCESS } from './route-access.config';

interface PublicRoute {
  method: string;
  pattern: RegExp;
}

// Routes that cannot carry a Clerk session token: infra probes, Swagger UI,
// and the Stripe webhook (authenticated by its own Stripe-Signature header).
const PUBLIC_ROUTES: PublicRoute[] = [
  { method: 'GET', pattern: /^\/health$/ },
  { method: 'GET', pattern: /^\/api\/docs(-json)?(\/.*)?$/ },
  { method: 'POST', pattern: /^\/payments\/webhook$/ },
];

@Injectable()
export class ClerkAuthGuard implements CanActivate {
  constructor(private readonly tokenVerifier: ITokenVerifier) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context
      .switchToHttp()
      .getRequest<Request & { auth?: VerifiedToken }>();

    if (
      PUBLIC_ROUTES.some(
        (r) => r.method === req.method && r.pattern.test(req.path),
      )
    ) {
      return true;
    }

    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing bearer token');
    }

    let auth: VerifiedToken;
    try {
      auth = await this.tokenVerifier.verify(header.slice(7));
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }

    if (auth.role !== 'admin') {
      const rule = ROUTE_ACCESS.find(
        (r) =>
          (!r.method || r.method === req.method) && r.pattern.test(req.path),
      );
      if (!rule || auth.role === null || !rule.roles.includes(auth.role)) {
        throw new ForbiddenException(
          rule
            ? `Requires role: ${rule.roles.join(' | ')}`
            : 'Requires role: admin',
        );
      }
    }

    req.auth = auth;
    return true;
  }
}
