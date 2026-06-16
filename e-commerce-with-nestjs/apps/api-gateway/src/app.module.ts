import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { TerminusModule } from '@nestjs/terminus';
import { ProxyController } from './proxy.controller';
import { ConsulService } from './consul.service';

@Module({
  imports: [TerminusModule, HttpModule],
  controllers: [ProxyController],
  providers: [ConsulService],
})
export class AppModule {}
