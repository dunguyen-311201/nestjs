/* eslint-disable @typescript-eslint/unbound-method -- jest.fn() mocks flagged as false positives */
import { NotificationConsumer } from './notification.consumer';
import { NotificationService } from './notification.service';
import {
  OrderCreatedEventV1,
  PaymentSucceededEventV1,
  ParcelDeliveredEventV1,
  ParcelRtsEventV1,
  ParcelLostSuspectedEventV1,
} from '@app/contracts';

describe('NotificationConsumer', () => {
  let notificationService: jest.Mocked<NotificationService>;
  let consumer: NotificationConsumer;

  beforeEach(() => {
    notificationService = {
      handleOrderCreated: jest.fn(),
      handlePaymentSucceeded: jest.fn(),
      handleParcelDelivered: jest.fn(),
      handleParcelRts: jest.fn(),
      handleParcelLostSuspected: jest.fn(),
    } as unknown as jest.Mocked<NotificationService>;

    consumer = new NotificationConsumer(notificationService);
  });

  it('delegates order.created to NotificationService', async () => {
    const event = {} as OrderCreatedEventV1;
    await consumer.onOrderCreated(event);
    expect(notificationService.handleOrderCreated).toHaveBeenCalledWith(event);
  });

  it('delegates payment.succeeded to NotificationService', async () => {
    const event = {} as PaymentSucceededEventV1;
    await consumer.onPaymentSucceeded(event);
    expect(notificationService.handlePaymentSucceeded).toHaveBeenCalledWith(
      event,
    );
  });

  it('delegates parcel.delivered to NotificationService', async () => {
    const event = {} as ParcelDeliveredEventV1;
    await consumer.onParcelDelivered(event);
    expect(notificationService.handleParcelDelivered).toHaveBeenCalledWith(
      event,
    );
  });

  it('delegates parcel.rts to NotificationService', async () => {
    const event = {} as ParcelRtsEventV1;
    await consumer.onParcelRts(event);
    expect(notificationService.handleParcelRts).toHaveBeenCalledWith(event);
  });

  it('delegates parcel.lost_suspected to NotificationService', async () => {
    const event = {} as ParcelLostSuspectedEventV1;
    await consumer.onParcelLostSuspected(event);
    expect(notificationService.handleParcelLostSuspected).toHaveBeenCalledWith(
      event,
    );
  });
});
