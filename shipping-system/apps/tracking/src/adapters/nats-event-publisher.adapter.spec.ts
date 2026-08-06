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
    await publisher.publish('parcel.lost_suspected', 'event-1', {
      parcel_id: 'parcel-1',
    });

    expect(emit).toHaveBeenCalledTimes(1);
    const [subject, record] = emit.mock.calls[0] as [string, NatsRecord];
    expect(subject).toBe('parcel.lost_suspected');
    expect(record).toBeInstanceOf(NatsRecord);
    expect(record.data).toEqual({ parcel_id: 'parcel-1' });
    expect(typeof record.headers?.get).toBe('function');
    expect(record.headers?.get('Nats-Msg-Id')).toBe('event-1');
  });
});
