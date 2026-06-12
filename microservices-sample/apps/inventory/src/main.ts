import { NestFactory } from '@nestjs/core';
import { InventoryModule } from './inventory.module';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';

async function bootstrap() {
  const app = await NestFactory.create(InventoryModule);
  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.TCP,
    options: { host: 'localhost', port: 8002 },
  });
  await app.startAllMicroservices();
  await app.listen(process.env.PORT ?? 3002);
}
void bootstrap();
