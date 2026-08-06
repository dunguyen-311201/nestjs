import { Inject, Injectable } from '@nestjs/common';
import { ClientProxy, NatsRecordBuilder } from '@nestjs/microservices';
import { headers } from 'nats';
import { firstValueFrom } from 'rxjs';
import { IEventPublisher } from '../ports/event-publisher.port';
import { NATS_CLIENT } from '../nats/nats-client.token';

@Injectable()
export class NatsEventPublisher implements IEventPublisher {
  constructor(@Inject(NATS_CLIENT) private readonly client: ClientProxy) {}

  async publish(
    subject: string,
    eventId: string,
    payload: Record<string, unknown>,
  ): Promise<void> {
    const msgHeaders = headers();
    msgHeaders.set('Nats-Msg-Id', eventId);
    const record = new NatsRecordBuilder(payload)
      .setHeaders(msgHeaders)
      .build();
    await firstValueFrom(this.client.emit(subject, record));
  }
}
