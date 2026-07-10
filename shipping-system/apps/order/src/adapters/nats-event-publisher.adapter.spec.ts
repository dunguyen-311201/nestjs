import { of } from 'rxjs';
import { NatsEventPublisher } from './nats-event-publisher.adapter';
import { NatsRecord } from '@nestjs/microservices';

describe('NatsEventPublisher', () => {
  let emit: jest.Mock;
  let client: { emit: jest.Mock };
  let publisher: NatsEventPublisher;

  beforeEach(() => {
    emit = jest.fn().mockReturnValue(of(undefined));
    client = { emit };
    publisher = new NatsEventPublisher(client as never);
  });

  it('emits the payload with Nats-Msg-Id set to the event id', async () => {
    await publisher.publish('order.created', 'event-1', { order_id: 'o-1' });

    expect(emit).toHaveBeenCalledTimes(1);
    const [subject, record] = emit.mock.calls[0] as [string, NatsRecord];
    expect(subject).toBe('order.created');
    expect(record).toBeInstanceOf(NatsRecord);
    expect(record.data).toEqual({ order_id: 'o-1' });
    // Headers must be a real nats-package MsgHdrs (built via headers()),
    // not a plain object - @nestjs/microservices' NatsRecordSerializer
    // calls .encode() on it, which a plain object doesn't have.
    expect(typeof record.headers?.get).toBe('function');
    expect(record.headers?.get('Nats-Msg-Id')).toBe('event-1');
  });
});
