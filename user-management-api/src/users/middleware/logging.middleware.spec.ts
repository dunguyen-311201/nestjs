import { Logger } from '@nestjs/common';
import { LoggingMiddleware } from './logging.middleware';

describe('LoggingMiddleware', () => {
  let middleware: LoggingMiddleware;
  let logSpy: jest.SpyInstance;

  beforeEach(() => {
    middleware = new LoggingMiddleware();
    logSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    logSpy.mockRestore();
  });

  it('should be defined', () => {
    expect(middleware).toBeTruthy();
  });

  it('should call next()', () => {
    const req = { method: 'GET', path: '/users' } as any;
    const res = {} as any;
    const next = jest.fn();

    middleware.use(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
  });

  it('should log the HTTP method and path', () => {
    const req = { method: 'POST', path: '/users' } as any;
    const res = {} as any;
    const next = jest.fn();

    middleware.use(req, res, next);

    expect(logSpy).toHaveBeenCalledWith('[POST] /users');
  });

  it('should log correctly for DELETE requests', () => {
    const req = { method: 'DELETE', path: '/users/1' } as any;
    const res = {} as any;
    const next = jest.fn();

    middleware.use(req, res, next);

    expect(logSpy).toHaveBeenCalledWith('[DELETE] /users/1');
    expect(next).toHaveBeenCalledTimes(1);
  });
});
