import { type ExecutionContext, Logger } from '@nestjs/common';
import type { CallHandler } from '@nestjs/common';
import { of } from 'rxjs';
import { LoggingInterceptor } from './logging.interceptor';

const createMockContext = (method: string, path: string): ExecutionContext =>
  ({
    switchToHttp: () => ({
      getRequest: () => ({ method, path }),
    }),
  }) as unknown as ExecutionContext;

const createMockHandler = (data: unknown): CallHandler => ({
  handle: () => of(data),
});

describe('LoggingInterceptor', () => {
  let interceptor: LoggingInterceptor;
  let logSpy: jest.SpyInstance;

  beforeEach(() => {
    interceptor = new LoggingInterceptor();
    logSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    logSpy.mockRestore();
  });

  it('should be defined', () => {
    expect(interceptor).toBeDefined();
  });

  it('should pass the response through unchanged', (done) => {
    const ctx = createMockContext('GET', '/users');
    const handler = createMockHandler([{ id: 1 }]);

    interceptor.intercept(ctx, handler).subscribe((result) => {
      expect(result).toEqual([{ id: 1 }]);
      done();
    });
  });

  it('should log method, path, and duration after the handler resolves', (done) => {
    const ctx = createMockContext('POST', '/users');
    const handler = createMockHandler({ id: 1 });

    interceptor.intercept(ctx, handler).subscribe(() => {
      expect(logSpy).toHaveBeenCalledWith(
        expect.stringMatching(/\[POST\] \/users → \d+ms/),
      );
      done();
    });
  });
});
