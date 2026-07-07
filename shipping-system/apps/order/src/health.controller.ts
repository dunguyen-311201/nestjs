import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

/**
 * Checks both the Order schema and the in-process-embedded Pricing schema
 * (docs/lld/pricing-service.md: Pricing has no separate process/app, it's
 * called in-process-boundary by Order - see apps/order/src/app.module.ts).
 */
@Controller('health')
export class HealthController {
  constructor(
    @InjectDataSource() private readonly orderDataSource: DataSource,
    @InjectDataSource('pricing') private readonly pricingDataSource: DataSource,
  ) {}

  @Get()
  async check(): Promise<{ status: string }> {
    try {
      await Promise.all([
        this.orderDataSource.query('SELECT 1'),
        this.pricingDataSource.query('SELECT 1'),
      ]);
      return { status: 'ok' };
    } catch (error) {
      throw new ServiceUnavailableException(
        `Database connection failed: ${(error as Error).message}`,
      );
    }
  }
}
