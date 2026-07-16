import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { ProxyService } from './proxy.service';

describe('ProxyService', () => {
  let service: ProxyService;
  let configService: { get: jest.Mock };

  beforeEach(async () => {
    configService = { get: jest.fn().mockReturnValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProxyService,
        { provide: ConfigService, useValue: configService },
      ],
    }).compile();

    service = module.get(ProxyService);
  });

  describe('resolveTarget', () => {
    it('resolves /orders to the order service default target', () => {
      expect(service.resolveTarget('/orders')).toBe('http://localhost:3001');
    });

    it('resolves nested paths under a known prefix', () => {
      expect(service.resolveTarget('/orders/abc-123/checkout')).toBe(
        'http://localhost:3001',
      );
    });

    it('resolves /payments to the order service (shared owner)', () => {
      expect(service.resolveTarget('/payments/webhook')).toBe(
        'http://localhost:3001',
      );
    });

    it('resolves /tracking, /couriers, /hubs, /trips, /legs to their own services', () => {
      expect(service.resolveTarget('/tracking/order-1')).toBe(
        'http://localhost:3003',
      );
      expect(service.resolveTarget('/couriers/legs/1/pickup')).toBe(
        'http://localhost:3004',
      );
      expect(service.resolveTarget('/hubs/1/receive')).toBe(
        'http://localhost:3005',
      );
      expect(service.resolveTarget('/trips')).toBe('http://localhost:3006');
      expect(service.resolveTarget('/trips/trip-123/depart')).toBe(
        'http://localhost:3006',
      );
      expect(service.resolveTarget('/trips/trip-123/assign')).toBe(
        'http://localhost:3007',
      );
      expect(service.resolveTarget('/legs/1/assign')).toBe(
        'http://localhost:3007',
      );
    });

    it('prefers an env override over the default target', () => {
      configService.get.mockImplementation((key: string) =>
        key === 'ORDER_SERVICE_URL'
          ? 'http://order-service.internal:9001'
          : undefined,
      );
      expect(service.resolveTarget('/orders')).toBe(
        'http://order-service.internal:9001',
      );
    });

    it('returns null for an unrecognized prefix', () => {
      expect(service.resolveTarget('/health')).toBeNull();
      expect(service.resolveTarget('/api/docs')).toBeNull();
    });

    it('does not match a prefix as a substring of an unrelated path', () => {
      expect(service.resolveTarget('/ordersxyz')).toBeNull();
    });
  });

  describe('buildForwardHeaders', () => {
    interface FakeAuthedRequest {
      headers: Record<string, string | string[] | undefined>;
      auth?: { userId: string; sessionId: string };
    }

    function requestWith(overrides: Partial<FakeAuthedRequest>) {
      return {
        headers: { accept: 'application/json' },
        ...overrides,
      } as Parameters<ProxyService['buildForwardHeaders']>[0];
    }

    it('injects verified identity headers when the request is authenticated', () => {
      const headers = service.buildForwardHeaders(
        requestWith({ auth: { userId: 'user_1', sessionId: 'sess_1' } }),
        'order.internal',
      );
      expect(headers['x-user-id']).toBe('user_1');
      expect(headers['x-session-id']).toBe('sess_1');
      expect(headers.host).toBe('order.internal');
      expect(headers.accept).toBe('application/json');
    });

    it('strips client-sent identity headers on unauthenticated requests', () => {
      const headers = service.buildForwardHeaders(
        requestWith({
          headers: { 'x-user-id': 'spoofed', 'x-session-id': 'spoofed' },
        }),
        'order.internal',
      );
      expect(headers['x-user-id']).toBeUndefined();
      expect(headers['x-session-id']).toBeUndefined();
    });

    it('overrides client-sent identity headers with the verified identity', () => {
      const headers = service.buildForwardHeaders(
        requestWith({
          headers: { 'x-user-id': 'spoofed' },
          auth: { userId: 'user_1', sessionId: 'sess_1' },
        }),
        'order.internal',
      );
      expect(headers['x-user-id']).toBe('user_1');
    });
  });
});
