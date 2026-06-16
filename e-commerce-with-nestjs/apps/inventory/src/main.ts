import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { InventoryModule } from './inventory.module';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';

async function bootstrap() {
  const logger = new Logger('InventoryService');
  const app = await NestFactory.create(InventoryModule);
  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.TCP,
    options: { host: 'localhost', port: 8002 },
  });
  await app.startAllMicroservices();
  logger.log('TCP microservice listening on port 8002');
  const port = process.env.PORT ?? 3002;
  await app.listen(port);
  logger.log(`Inventory Service running on http://localhost:${port}`);
}
void bootstrap();
