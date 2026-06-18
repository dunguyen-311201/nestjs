import { Logger, ValidationPipe, VersioningType } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import {
  HttpExceptionFilter,
  LoggingInterceptor,
  TransformInterceptor,
} from '@app/common';
import { OrderModule } from './order.module';

async function bootstrap() {
  const logger = new Logger('OrderService');
  const app = await NestFactory.create(OrderModule);
  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.TCP,
    options: { host: 'localhost', port: 8001 },
  });
  app.enableVersioning({
    type: VersioningType.URI,
    prefix: 'v',
    defaultVersion: '1',
  });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(
    new LoggingInterceptor(),
    new TransformInterceptor(),
  );
  await app.startAllMicroservices();
  logger.log('TCP microservice listening on port 8001');
  const port = process.env.PORT ?? 3001;
  await app.listen(port);
  logger.log(`Order Service running on http://localhost:${port}`);
}
void bootstrap();
