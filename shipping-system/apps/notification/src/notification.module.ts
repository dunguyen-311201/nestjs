import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NotificationConsumer } from './notification.consumer';
import { NotificationService } from './notification.service';
import { IEmailProvider } from './ports/email-provider.port';
import { LoggingEmailAdapter } from './adapters/logging-email.adapter';
import { SendGridEmailAdapter } from './adapters/sendgrid-email.adapter';

@Module({
  controllers: [NotificationConsumer],
  providers: [
    NotificationService,
    {
      provide: IEmailProvider,
      inject: [ConfigService],
      useFactory: (configService: ConfigService): IEmailProvider =>
        configService.get<string>('SENDGRID_API_KEY')
          ? new SendGridEmailAdapter(configService)
          : new LoggingEmailAdapter(),
    },
  ],
})
export class NotificationModule {}
