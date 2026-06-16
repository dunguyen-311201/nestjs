import { Logger, ValidationPipe, VersioningType } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { HttpExceptionFilter, LoggingInterceptor } from '@app/common';
import { ProductsModule } from './products.module';

async function bootstrap() {
  const logger = new Logger('ProductService');
  const app = await NestFactory.create(ProductsModule);
  app.enableVersioning({
    type: VersioningType.URI,
    prefix: 'v',
    defaultVersion: '1',
  });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(new LoggingInterceptor());
  const port = process.env.PORT ?? 3004;
  await app.listen(port);
  logger.log(`Product Service running on http://localhost:${port}`);
}
void bootstrap();
