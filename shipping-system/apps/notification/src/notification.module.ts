import { Module } from '@nestjs/common';
import { NotificationConsumer } from './notification.consumer';
import { NotificationService } from './notification.service';
import { IEmailProvider } from './ports/email-provider.port';
import { LoggingEmailAdapter } from './adapters/logging-email.adapter';

@Module({
  controllers: [NotificationConsumer],
  providers: [
    NotificationService,
    { provide: IEmailProvider, useClass: LoggingEmailAdapter },
  ],
})
export class NotificationModule {}
