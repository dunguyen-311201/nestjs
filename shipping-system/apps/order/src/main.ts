import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { Transport } from '@nestjs/microservices';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.connectMicroservice({
    transport: Transport.NATS,
    options: { servers: [process.env.NATS_URL ?? 'nats://localhost:4222'] },
  });
  await app.startAllMicroservices();
  await app.listen(process.env.PORT ?? 3001);
}
void bootstrap();
