import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

// Notification has zero REST endpoints and owns no table - a pure NATS
// consumer. No HTTP listener, no DataSource. The actual JetStream
// @EventPattern consumers are later work; for now this only proves the
// raw NATS connection works (see main.ts).
@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true })],
})
export class AppModule {}
