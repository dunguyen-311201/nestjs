import { Module } from '@nestjs/common';
import { InventoryController } from './inventory.controller';
import { InventoryService } from './inventory.service';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { ConsulService } from './consul.service';

@Module({
  imports: [
    ClientsModule.register([
      {
        name: 'ORDER_SERVICE',
        transport: Transport.TCP,
        options: {
          host: 'localhost',
          port: 8001,
        },
      },
    ]),
  ],
  controllers: [InventoryController],
  providers: [InventoryService, ConsulService],
})
export class InventoryModule {}
