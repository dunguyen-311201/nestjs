import { NestFactory } from '@nestjs/core';
import { connect } from 'nats';
import { AppModule } from './app.module';

// No app.listen() and no app.connectMicroservice() yet - Notification is a
// pure NATS consumer (docs/lld/notification-service.md), and the JetStream
// transport approach is deliberately undecided until Phase 5 (see
// IMPLEMENTATION_CHECKLIST.md). This bootstrap only proves raw NATS
// connectivity against the local shipping_nats container.
async function bootstrap() {
  await NestFactory.createApplicationContext(AppModule);

  const natsUrl = process.env.NATS_URL ?? 'nats://localhost:4222';
  const connection = await connect({ servers: natsUrl });

  console.log(`notification connected to NATS at ${connection.getServer()}`);
  await connection.close();
}
void bootstrap();
