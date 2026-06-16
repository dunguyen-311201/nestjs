import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { ProxyController } from 'apps/api-gateway/src/proxy.controller';

@Module({
  imports: [TerminusModule, HttpModule],
  controllers: [ProxyController],
  providers: [],
})
export class AppModule {}
