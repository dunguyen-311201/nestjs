import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { Transport } from '@nestjs/microservices';
import { AppModule } from './app.module';

async function bootstrap() {
  // rawBody: true preserves the exact bytes Stripe signed, needed by
  // PaymentController's webhook signature verification (Stripe-Signature
  // must be checked against the raw body, before JSON parsing).
  const app = await NestFactory.create(AppModule, { rawBody: true });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.connectMicroservice({
    transport: Transport.NATS,
    options: { servers: [process.env.NATS_URL ?? 'nats://localhost:4222'] },
  });
  await app.startAllMicroservices();
  await app.listen(process.env.PORT ?? 3001);
}
void bootstrap();
