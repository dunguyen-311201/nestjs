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
  app.enableCors({
    origin: process.env.WEB_ORIGIN ?? 'http://localhost:5173',
    allowedHeaders: ['Authorization', 'Content-Type', 'Idempotency-Key'],
  });

  if (process.env.NODE_ENV !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('API Gateway')
      .setDescription('Shipping System - API Gateway')
      .setVersion('1.0')
      .addBearerAuth()
      .addSecurityRequirements('bearer')
      .build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document, {
      explorer: true,
      swaggerOptions: {
        urls: [
          { name: 'API Gateway', url: '/api/docs-json' },
          { name: 'Order Service', url: '/api/docs/order/json' },
          { name: 'Tracking Service', url: '/api/docs/tracking/json' },
          { name: 'Courier Service', url: '/api/docs/courier/json' },
          { name: 'Hub Service', url: '/api/docs/hub/json' },
          { name: 'Linehaul Service', url: '/api/docs/linehaul/json' },
          { name: 'Dispatcher Service', url: '/api/docs/dispatcher/json' },
        ],
      },
    });
  }

  await app.listen(process.env.PORT ?? 3000);
}
void bootstrap();
