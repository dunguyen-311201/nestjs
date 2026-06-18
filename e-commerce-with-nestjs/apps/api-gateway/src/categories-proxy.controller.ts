import {
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '@app/common';
import { RouteProxyService } from './route-proxy.service';

@UseGuards(JwtAuthGuard)
@Controller({ path: 'categories', version: '1' })
export class CategoriesProxyController {
  constructor(private readonly proxy: RouteProxyService) {}

  @Post()
  create(@Req() req: Request): Promise<unknown> {
    return this.proxy.forward('product-service', '/v1/categories', req);
  }

  @Get()
  findAll(@Req() req: Request): Promise<unknown> {
    return this.proxy.forward('product-service', '/v1/categories', req);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Req() req: Request): Promise<unknown> {
    return this.proxy.forward('product-service', `/v1/categories/${id}`, req);
  }

  @Put(':id')
  update(@Param('id') id: string, @Req() req: Request): Promise<unknown> {
    return this.proxy.forward('product-service', `/v1/categories/${id}`, req);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Req() req: Request): Promise<unknown> {
    return this.proxy.forward('product-service', `/v1/categories/${id}`, req);
  }
}
