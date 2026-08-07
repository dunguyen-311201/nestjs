import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { NotificationConsumer } from './notification.consumer';
import { NotificationService } from './notification.service';
import { IEmailProvider } from './ports/email-provider.port';
import { LoggingEmailAdapter } from './adapters/logging-email.adapter';
import { SendGridEmailAdapter } from './adapters/sendgrid-email.adapter';
import { ResendEmailAdapter } from './adapters/resend-email.adapter';
import { IIdempotencyStore } from './ports/idempotency-store.port';
import {
  REDIS_CLIENT,
  RedisIdempotencyAdapter,
} from './adapters/redis-idempotency.adapter';

@Module({
  controllers: [NotificationConsumer],
  providers: [
    NotificationService,
    {
      provide: IEmailProvider,
      inject: [ConfigService],
      useFactory: (configService: ConfigService): IEmailProvider => {
        if (configService.get<string>('RESEND_API_KEY')) {
          return new ResendEmailAdapter(configService);
        }
        if (configService.get<string>('SENDGRID_API_KEY')) {
          return new SendGridEmailAdapter(configService);
        }
        return new LoggingEmailAdapter();
      },
    },
    { provide: IIdempotencyStore, useClass: RedisIdempotencyAdapter },
    {
      provide: REDIS_CLIENT,
      useFactory: () =>
        new Redis({
          host: process.env.REDIS_HOST ?? 'localhost',
          port: Number(process.env.REDIS_PORT ?? 6379),
        }),
    },
  ],
})
export class NotificationModule {}
