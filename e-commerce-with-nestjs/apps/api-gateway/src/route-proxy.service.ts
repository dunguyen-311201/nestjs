import {
  HttpException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import type { Request } from 'express';
import { ConsulService } from './consul.service';

interface UpstreamError {
  response: { data: Record<string, unknown>; status: number };
}

function isUpstreamError(err: unknown): err is UpstreamError {
  return (
    typeof err === 'object' &&
    err !== null &&
    'response' in err &&
    typeof (err as UpstreamError).response === 'object'
  );
}

@Injectable()
export class RouteProxyService {
  private readonly fallbackUrls: Record<string, string> = {
    'user-service': process.env.USER_SERVICE_URL ?? 'http://localhost:3003',
    'product-service':
      process.env.PRODUCT_SERVICE_URL ?? 'http://localhost:3004',
    'order-service': process.env.ORDER_SERVICE_URL ?? 'http://localhost:3001',
  };

  constructor(
    private readonly httpService: HttpService,
    private readonly consulService: ConsulService,
  ) {}

  async forward(
    serviceName: string,
    path: string,
    req: Request,
  ): Promise<unknown> {
    const baseUrl = await this.resolveUrl(serviceName);
    try {
      const response = await firstValueFrom(
        this.httpService.request<Record<string, unknown>>({
          method: req.method,
          url: `${baseUrl}${path}`,
          data: req.body as Record<string, unknown>,
          params: req.query,
          headers: {
            'content-type': 'application/json',
            ...(req.headers.authorization && {
              authorization: req.headers.authorization,
            }),
          },
        }),
      );
      return response.data;
    } catch (err: unknown) {
      if (isUpstreamError(err)) {
        throw new HttpException(err.response.data, err.response.status);
      }
      throw new ServiceUnavailableException(`${serviceName} is unavailable`);
    }
  }

  private async resolveUrl(serviceName: string): Promise<string> {
    const nodes = await this.consulService.discoverService(serviceName);
    if (nodes && nodes.length > 0) {
      return `http://${nodes[0].ServiceAddress}:${nodes[0].ServicePort}`;
    }
    return this.fallbackUrls[serviceName];
  }
}
