import { Logger, ValidationPipe, VersioningType } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import {
  HttpExceptionFilter,
  LoggingInterceptor,
  TransformInterceptor,
} from '@app/common';
import { ProductsModule } from './products.module';

async function bootstrap() {
  const logger = new Logger('ProductService');
  const app = await NestFactory.create(ProductsModule);

  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.TCP,
    options: { host: 'localhost', port: 8003 },
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
  const port = process.env.PORT ?? 3004;
  await app.listen(port);
  logger.log(`Product Service running on http://localhost:${port} (TCP :8003)`);
}
void bootstrap();
