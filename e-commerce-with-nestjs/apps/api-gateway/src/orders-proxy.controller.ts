import {
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '@app/common';
import { RouteProxyService } from './route-proxy.service';

@UseGuards(JwtAuthGuard)
@Controller({ path: 'orders', version: '1' })
export class OrdersProxyController {
  constructor(private readonly proxy: RouteProxyService) {}

  @Post()
  create(@Req() req: Request): Promise<unknown> {
    return this.proxy.forward('order-service', '/v1/orders', req);
  }

  @Get()
  findAll(@Req() req: Request): Promise<unknown> {
    return this.proxy.forward('order-service', '/v1/orders', req);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Req() req: Request): Promise<unknown> {
    return this.proxy.forward('order-service', `/v1/orders/${id}`, req);
  }

  @Patch(':id/status')
  updateStatus(@Param('id') id: string, @Req() req: Request): Promise<unknown> {
    return this.proxy.forward('order-service', `/v1/orders/${id}/status`, req);
  }
}
