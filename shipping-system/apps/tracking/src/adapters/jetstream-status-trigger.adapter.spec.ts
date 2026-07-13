import { JetStreamStatusTriggerPublisher } from './jetstream-status-trigger.adapter';

describe('JetStreamStatusTriggerPublisher', () => {
  let jsPublish: jest.Mock;
  let js: { publish: jest.Mock };
  let publisher: JetStreamStatusTriggerPublisher;

  beforeEach(() => {
    jsPublish = jest.fn().mockResolvedValue(undefined);
    js = { publish: jsPublish };
    publisher = new JetStreamStatusTriggerPublisher(js as never);
  });

  it('publishes an empty trigger payload to the per-order status subject via JetStream', async () => {
    await publisher.publish('order-1');

    expect(jsPublish).toHaveBeenCalledTimes(1);
    const [subject, payload] = jsPublish.mock.calls[0] as [string, Uint8Array];
    expect(subject).toBe('shipment_orders.status.order-1');
    expect(Buffer.from(payload).toString()).toBe('{}');
  });
});
