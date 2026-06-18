import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { TerminusModule } from '@nestjs/terminus';
import { JwtAuthGuard } from '@app/common';
import { AuthProxyController } from './auth-proxy.controller';
import { CategoriesProxyController } from './categories-proxy.controller';
import { ConsulService } from './consul.service';
import { OrdersProxyController } from './orders-proxy.controller';
import { ProductsProxyController } from './products-proxy.controller';
import { RouteProxyService } from './route-proxy.service';
import { UsersProxyController } from './users-proxy.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TerminusModule,
    HttpModule,
    JwtModule.register({ secret: process.env.JWT_SECRET }),
  ],
  controllers: [
    AuthProxyController,
    UsersProxyController,
    ProductsProxyController,
    CategoriesProxyController,
    OrdersProxyController,
  ],
  providers: [ConsulService, RouteProxyService, JwtAuthGuard],
})
export class AppModule {}
