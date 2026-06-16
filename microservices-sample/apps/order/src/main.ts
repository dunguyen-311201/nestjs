import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { OrderModule } from './order.module';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';

async function bootstrap() {
  const logger = new Logger('OrderService');
  const app = await NestFactory.create(OrderModule);
  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.TCP,
    options: {
      host: 'localhost',
      port: 8001,
    },
  });
  await app.startAllMicroservices();
  logger.log('TCP microservice listening on port 8001');
  const port = process.env.PORT ?? 3001;
  await app.listen(port);
  logger.log(`Order Service running on http://localhost:${port}`);
}
void bootstrap();
