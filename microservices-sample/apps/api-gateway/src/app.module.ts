import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { TerminusModule } from '@nestjs/terminus';
import { ProxyController } from './proxy.controller';

@Module({
  imports: [TerminusModule, HttpModule],
  controllers: [ProxyController],
})
export class AppModule {}
