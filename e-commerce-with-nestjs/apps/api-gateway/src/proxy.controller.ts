import { Controller, Post, Req, Res } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import type { Request, Response } from 'express';
import { ConsulService } from './consul.service';

@Controller('orders')
export class ProxyController {
  constructor(
    private httpService: HttpService,
    private consulService: ConsulService,
  ) {}

  @Post()
  async forwardToOrderService(@Req() req: Request, @Res() res: Response) {
    const services = await this.consulService.discoverService('order-service');

    let orderServiceUrl = 'http://localhost:3001';
    if (services && services.length > 0) {
      const service = services[0];
      orderServiceUrl = `http://${service.ServiceAddress}:${service.ServicePort}`;
    }

    const axiosResponse = await firstValueFrom(
      this.httpService.post(`${orderServiceUrl}/create-order`, req.body),
    );

    res.json(axiosResponse.data);
  }
}
