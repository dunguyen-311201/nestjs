import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HealthController } from './health.controller';
import { ProxyModule } from './proxy/proxy.module';

// No DB connection here - the gateway only does auth/routing/validation.
// Routing to services is via static *_SERVICE_URL env vars (no
// Consul/service discovery in this project). HealthController is declared
// directly on this module so its /health route binds before ProxyModule's
// catch-all wildcard route.
@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), ProxyModule],
  controllers: [HealthController],
})
export class AppModule {}
