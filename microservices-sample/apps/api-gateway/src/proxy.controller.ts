import { Controller, Post, Req, Res } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import type { Request, Response } from 'express';

@Controller('orders')
export class ProxyController {
  constructor(private httpService: HttpService) {}

  @Post()
  async forwardToOrderService(@Req() req: Request, @Res() res: Response) {
    const axiosResponse = await firstValueFrom(
      this.httpService.post('http://localhost:3001/create-order', req.body),
    );

    res.json(axiosResponse.data);

    // return res.status(axiosResponse.status).send(axiosResponse.data);
  }
}
