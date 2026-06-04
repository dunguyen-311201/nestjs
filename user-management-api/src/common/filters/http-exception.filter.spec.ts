import { ArgumentsHost, HttpException, HttpStatus } from '@nestjs/common';
import { HttpExceptionFilter } from './http-exception.filter';

const createMockHost = (mockResponse: object): ArgumentsHost =>
  ({
    switchToHttp: () => ({
      getResponse: () => mockResponse,
    }),
  }) as unknown as ArgumentsHost;

describe('HttpExceptionFilter', () => {
  let filter: HttpExceptionFilter;
  let mockResponse: { status: jest.Mock; json: jest.Mock };

  beforeEach(() => {
    filter = new HttpExceptionFilter();
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
  });

  it('should be defined', () => {
    expect(filter).toBeDefined();
  });

  it('should respond with the exception status code', () => {
    const exception = new HttpException('Not Found', HttpStatus.NOT_FOUND);
    filter.catch(exception, createMockHost(mockResponse));
    expect(mockResponse.status).toHaveBeenCalledWith(404);
  });

  it('should respond with timestamp and message in the body', () => {
    const exception = new HttpException('Forbidden', HttpStatus.FORBIDDEN);
    filter.catch(exception, createMockHost(mockResponse));
    expect(mockResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Forbidden',
        timestamp: expect.any(String),
      }),
    );
  });

  it('should respond with 401 for UnauthorizedException', () => {
    const exception = new HttpException(
      'Unauthorized',
      HttpStatus.UNAUTHORIZED,
    );
    filter.catch(exception, createMockHost(mockResponse));
    expect(mockResponse.status).toHaveBeenCalledWith(401);
    expect(mockResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Unauthorized' }),
    );
  });
});
