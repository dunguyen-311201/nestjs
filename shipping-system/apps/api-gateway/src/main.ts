import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  // bodyParser: false - the gateway forwards raw request bytes to upstream
  // services unparsed (ProxyService pipes req directly into the outbound
  // request); Nest's default body parser would otherwise consume the
  // stream before the proxy ever sees it, leaving the upstream request
  // waiting for a body that never arrives.
  const app = await NestFactory.create(AppModule, { bodyParser: false });

  const config = new DocumentBuilder()
    .setTitle('API Gateway')
    .setDescription('Shipping System - API Gateway')
    .setVersion('1.0')
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  await app.listen(process.env.PORT ?? 3000);
}
void bootstrap();
