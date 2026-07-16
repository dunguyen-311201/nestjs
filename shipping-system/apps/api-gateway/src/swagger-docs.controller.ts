import {
  Controller,
  Get,
  Param,
  NotFoundException,
  BadGatewayException,
  HttpException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

const SERVICE_PORTS: Record<string, { envKey: string; defaultUrl: string }> = {
  order: { envKey: 'ORDER_SERVICE_URL', defaultUrl: 'http://localhost:3001' },
  tracking: {
    envKey: 'TRACKING_SERVICE_URL',
    defaultUrl: 'http://localhost:3003',
  },
  courier: {
    envKey: 'COURIER_SERVICE_URL',
    defaultUrl: 'http://localhost:3004',
  },
  hub: { envKey: 'HUB_SERVICE_URL', defaultUrl: 'http://localhost:3005' },
  linehaul: {
    envKey: 'LINEHAUL_SERVICE_URL',
    defaultUrl: 'http://localhost:3006',
  },
  dispatcher: {
    envKey: 'DISPATCHER_SERVICE_URL',
    defaultUrl: 'http://localhost:3007',
  },
};

@Controller('api/docs')
export class SwaggerDocsController {
  constructor(private readonly configService: ConfigService) {}

  @Get(':service/json')
  async getServiceSchema(@Param('service') service: string) {
    const config = SERVICE_PORTS[service];
    if (!config) {
      throw new NotFoundException(`Service ${service} not found`);
    }

    const baseUrl =
      this.configService.get<string>(config.envKey) ?? config.defaultUrl;
    const url = `${baseUrl}/api/docs-json`;

    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new BadGatewayException(
          `Failed to fetch swagger spec from ${service} service (HTTP ${response.status})`,
        );
      }
      return (await response.json()) as Record<string, unknown>;
    } catch (err) {
      if (err instanceof HttpException) {
        throw err;
      }
      throw new BadGatewayException(
        `Could not reach ${service} service: ${(err as Error).message}`,
      );
    }
  }
}
