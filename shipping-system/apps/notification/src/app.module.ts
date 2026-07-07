import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

// Notification (docs/lld/notification-service.md) has zero REST endpoints
// and owns no table - a pure NATS consumer. No HTTP listener, no DataSource.
// The actual JetStream @EventPattern consumers are Phase 5 work; Phase 4
// only proves the raw NATS connection works (see main.ts).
@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true })],
})
export class AppModule {}
