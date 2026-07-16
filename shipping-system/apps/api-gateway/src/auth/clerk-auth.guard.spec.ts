import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
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
  const verified: VerifiedToken = { userId: 'user_123', sessionId: 'sess_1' };

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
