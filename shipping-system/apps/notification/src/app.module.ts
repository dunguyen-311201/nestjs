import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { NotificationModule } from './notification.module';

// Notification has zero REST endpoints and owns no table - a pure NATS
// consumer. No HTTP listener, no DataSource.
@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), NotificationModule],
})
export class AppModule {}
