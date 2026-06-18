import { Controller, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { RouteProxyService } from './route-proxy.service';

@Controller({ path: 'auth', version: '1' })
export class AuthProxyController {
  constructor(private readonly proxy: RouteProxyService) {}

  @Post('signup')
  signup(@Req() req: Request): Promise<unknown> {
    return this.proxy.forward('user-service', '/v1/auth/signup', req);
  }

  @Post('login')
  login(@Req() req: Request): Promise<unknown> {
    return this.proxy.forward('user-service', '/v1/auth/login', req);
  }
}
