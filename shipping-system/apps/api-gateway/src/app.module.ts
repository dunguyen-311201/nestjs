import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
import { HealthController } from './health.controller';
import { ProxyModule } from './proxy/proxy.module';

// No DB connection here - the gateway only does auth/routing/validation.
// Routing to services is via static *_SERVICE_URL env vars (no
// Consul/service discovery in this project) - actual proxy logic is
// implemented in ProxyModule.
@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), AuthModule, ProxyModule],
  controllers: [HealthController],
})
export class AppModule {}
