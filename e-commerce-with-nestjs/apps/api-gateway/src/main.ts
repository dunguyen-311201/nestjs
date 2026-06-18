import { Logger, VersioningType } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { HttpExceptionFilter, LoggingInterceptor } from '@app/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const logger = new Logger('ApiGateway');
  const app = await NestFactory.create(AppModule);
  app.enableVersioning({
    type: VersioningType.URI,
    prefix: 'v',
    defaultVersion: '1',
  });
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(new LoggingInterceptor());
  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  logger.log(`Api Gateway running on http://localhost:${port}`);
}
void bootstrap();
