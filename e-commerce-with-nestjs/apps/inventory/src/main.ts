import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import {
  HttpExceptionFilter,
  LoggingInterceptor,
  TransformInterceptor,
} from '@app/common';
import { InventoryModule } from './inventory.module';

async function bootstrap() {
  const logger = new Logger('InventoryService');
  const app = await NestFactory.create(InventoryModule);
  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.TCP,
    options: { host: 'localhost', port: 8002 },
  });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(
    new LoggingInterceptor(),
    new TransformInterceptor(),
  );
  await app.startAllMicroservices();
  logger.log('TCP microservice listening on port 8002');
  const port = process.env.PORT ?? 3002;
  await app.listen(port);
  logger.log(`Inventory Service running on http://localhost:${port}`);
}
void bootstrap();
