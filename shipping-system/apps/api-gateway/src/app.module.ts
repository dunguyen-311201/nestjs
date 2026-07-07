import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HealthController } from './health.controller';

// No DB connection here - the gateway only does auth/routing/validation
// (docs/02-HLD.md "Logical Components"). Routing to services is via static
// *_SERVICE_URL env vars (no Consul/service discovery in this project) -
// actual proxy logic is Phase 5.
@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true })],
  controllers: [HealthController],
})
export class AppModule {}
