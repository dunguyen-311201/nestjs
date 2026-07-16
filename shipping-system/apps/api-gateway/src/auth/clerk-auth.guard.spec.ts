import {
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { ClerkAuthGuard } from './clerk-auth.guard';
import { ITokenVerifier, VerifiedToken } from './ports/token-verifier.port';

class FakeTokenVerifier extends ITokenVerifier {
  constructor(private readonly result: VerifiedToken | Error) {
    super();
  }

  verify(): Promise<VerifiedToken> {
    if (this.result instanceof Error) {
      return Promise.reject(this.result);
    }
    return Promise.resolve(this.result);
  }
}

interface FakeRequest {
  method: string;
  path: string;
  headers: Record<string, string | undefined>;
  auth?: VerifiedToken;
}

function contextFor(req: FakeRequest): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => req }),
  } as unknown as ExecutionContext;
}

describe('ClerkAuthGuard', () => {
  const verified: VerifiedToken = {
    userId: 'user_123',
    sessionId: 'sess_1',
    role: 'customer',
  };

  function guardWith(result: VerifiedToken | Error): ClerkAuthGuard {
    return new ClerkAuthGuard(new FakeTokenVerifier(result));
  }

  it('allows a request with a valid bearer token and attaches auth', async () => {
    const req: FakeRequest = {
      method: 'GET',
      path: '/orders',
      headers: { authorization: 'Bearer good-token' },
    };
    await expect(
      guardWith(verified).canActivate(contextFor(req)),
    ).resolves.toBe(true);
    expect(req.auth).toEqual(verified);
    expect(req.auth?.role).toBe('customer');
  });

  describe('role enforcement (RBAC)', () => {
    function reqFor(method: string, path: string): FakeRequest {
      return { method, path, headers: { authorization: 'Bearer t' } };
    }

    it.each([
      ['customer', 'GET', '/orders'],
      ['customer', 'POST', '/orders'],
      ['customer', 'POST', '/orders/o-1/checkout'],
      ['customer', 'GET', '/payments/p-1'],
      ['customer', 'GET', '/tracking/o-1'],
      ['shipper', 'POST', '/couriers/legs/l-1/pickup'],
      ['shipper', 'POST', '/couriers/legs/l-1/deliver'],
      ['hub_staff', 'POST', '/hubs/h-1/receive'],
      ['dispatcher', 'POST', '/trips'],
      ['dispatcher', 'POST', '/trips/t-1/assign'],
      ['dispatcher', 'POST', '/legs/l-1/assign'],
      ['admin', 'GET', '/orders'],
      ['admin', 'POST', '/hubs/h-1/receive'],
      ['admin', 'POST', '/legs/l-1/assign'],
      ['admin', 'GET', '/some-future-route'],
    ] as const)('allows %s to %s %s', async (role, method, path) => {
      const req = reqFor(method, path);
      await expect(
        guardWith({ ...verified, role }).canActivate(contextFor(req)),
      ).resolves.toBe(true);
      expect(req.auth?.role).toBe(role);
    });

    it.each([
      ['customer', 'POST', '/hubs/h-1/receive'],
      ['customer', 'POST', '/legs/l-1/assign'],
      ['shipper', 'GET', '/orders'],
      ['shipper', 'POST', '/trips'],
      ['hub_staff', 'POST', '/couriers/legs/l-1/pickup'],
      ['dispatcher', 'GET', '/tracking/o-1'],
      ['customer', 'GET', '/some-future-route'],
    ] as const)(
      'forbids %s from %s %s with 403',
      async (role, method, path) => {
        await expect(
          guardWith({ ...verified, role }).canActivate(
            contextFor(reqFor(method, path)),
          ),
        ).rejects.toThrow(ForbiddenException);
      },
    );

    it('forbids an authenticated user with no role (403, not 401)', async () => {
      await expect(
        guardWith({ ...verified, role: null }).canActivate(
          contextFor(reqFor('GET', '/orders')),
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('still returns 401, not 403, when the token itself is invalid', async () => {
      await expect(
        guardWith(new Error('bad token')).canActivate(
          contextFor(reqFor('GET', '/orders')),
        ),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  it('rejects a request with no Authorization header', async () => {
    const req: FakeRequest = { method: 'GET', path: '/orders', headers: {} };
    await expect(
      guardWith(verified).canActivate(contextFor(req)),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('rejects a non-Bearer Authorization header', async () => {
    const req: FakeRequest = {
      method: 'GET',
      path: '/orders',
      headers: { authorization: 'Basic abc' },
    };
    await expect(
      guardWith(verified).canActivate(contextFor(req)),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('rejects when token verification fails', async () => {
    const req: FakeRequest = {
      method: 'GET',
      path: '/orders',
      headers: { authorization: 'Bearer expired-token' },
    };
    await expect(
      guardWith(new Error('token expired')).canActivate(contextFor(req)),
    ).rejects.toThrow(UnauthorizedException);
  });

  it.each([
    ['GET', '/health'],
    ['GET', '/api/docs'],
    ['GET', '/api/docs-json'],
    ['GET', '/api/docs/order/json'],
    ['POST', '/payments/webhook'],
  ])('allows public route %s %s without a token', async (method, path) => {
    const req: FakeRequest = { method, path, headers: {} };
    await expect(
      guardWith(new Error('should not be called')).canActivate(contextFor(req)),
    ).resolves.toBe(true);
  });

  it('does not treat non-webhook payment routes as public', async () => {
    const req: FakeRequest = { method: 'POST', path: '/payments', headers: {} };
    await expect(
      guardWith(verified).canActivate(contextFor(req)),
    ).rejects.toThrow(UnauthorizedException);
  });
});
