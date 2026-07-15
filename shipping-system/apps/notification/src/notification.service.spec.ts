/* eslint-disable @typescript-eslint/unbound-method -- jest.fn() mocks flagged as false positives */
import { NotificationService } from './notification.service';
import { IEmailProvider } from './ports/email-provider.port';
import {
  OrderCreatedEventV1,
  PaymentSucceededEventV1,
  ParcelDeliveredEventV1,
  ParcelRtsEventV1,
  ParcelLostSuspectedEventV1,
} from '@app/contracts';

describe('NotificationService', () => {
  let emailProvider: jest.Mocked<IEmailProvider>;
  let service: NotificationService;

  beforeEach(() => {
    emailProvider = {
      send: jest.fn().mockResolvedValue(undefined),
    };
    service = new NotificationService(emailProvider);
  });

  describe('handleOrderCreated', () => {
    it('sends correct order created email', async () => {
      const event: OrderCreatedEventV1 = {
        event_id: 'evt-1',
        occurred_at: '2026-07-15T00:00:00Z',
        order_id: 'order-123',
        sender_id: 'sender-1',
        recipient_id: 'recipient-1',
        parcel_ids: ['parcel-1', 'parcel-2'],
      };

      await service.handleOrderCreated(event);

      expect(emailProvider.send).toHaveBeenCalledWith(
        'order-123',
        'Order Created: order-123',
        'Your order order-123 has been successfully created with 2 parcels.',
      );
    });
  });

  describe('handlePaymentSucceeded', () => {
    it('sends correct payment succeeded email', async () => {
      const event: PaymentSucceededEventV1 = {
        event_id: 'evt-2',
        occurred_at: '2026-07-15T00:00:00Z',
        order_id: 'order-123',
        payment_id: 'pay-1',
      };

      await service.handlePaymentSucceeded(event);

      expect(emailProvider.send).toHaveBeenCalledWith(
        'order-123',
        'Payment Succeeded: order-123',
        'Your payment for order order-123 (Payment ID: pay-1) has succeeded.',
      );
    });
  });

  describe('handleParcelDelivered', () => {
    it('sends correct parcel delivered email', async () => {
      const event: ParcelDeliveredEventV1 = {
        event_id: 'evt-3',
        occurred_at: '2026-07-15T00:00:00Z',
        parcel_id: 'parcel-123',
        courier_id: 'courier-1',
        signature_url: null,
        photo_url: null,
      };

      await service.handleParcelDelivered(event);

      expect(emailProvider.send).toHaveBeenCalledWith(
        'parcel-123',
        'Parcel Delivered: parcel-123',
        'Your parcel parcel-123 has been delivered by courier courier-1.',
      );
    });
  });

  describe('handleParcelRts', () => {
    it('sends correct parcel rts email', async () => {
      const event: ParcelRtsEventV1 = {
        event_id: 'evt-4',
        occurred_at: '2026-07-15T00:00:00Z',
        parcel_id: 'parcel-123',
      };

      await service.handleParcelRts(event);

      expect(emailProvider.send).toHaveBeenCalledWith(
        'parcel-123',
        'Parcel Return to Sender (RTS): parcel-123',
        'Your parcel parcel-123 is being returned to the sender.',
      );
    });
  });

  describe('handleParcelLostSuspected', () => {
    it('sends correct parcel lost suspected email', async () => {
      const event: ParcelLostSuspectedEventV1 = {
        event_id: 'evt-5',
        occurred_at: '2026-07-15T00:00:00Z',
        parcel_id: 'parcel-123',
        last_scan_type: 'DEPARTED_LINEHAUL',
        last_scan_at: '2026-07-15T00:00:00Z',
      };

      await service.handleParcelLostSuspected(event);

      expect(emailProvider.send).toHaveBeenCalledWith(
        'parcel-123',
        'Parcel Lost Suspected: parcel-123',
        'Your parcel parcel-123 is suspected to be lost. Last scan type was DEPARTED_LINEHAUL at 2026-07-15T00:00:00Z.',
      );
    });
  });

  describe('error handling (BR-09)', () => {
    it('swallows errors thrown by the email provider and does not propagate them', async () => {
      emailProvider.send.mockRejectedValueOnce(
        new Error('SMTP connection timed out'),
      );

      const event: ParcelRtsEventV1 = {
        event_id: 'evt-4',
        occurred_at: '2026-07-15T00:00:00Z',
        parcel_id: 'parcel-123',
      };

      // Should complete successfully without throwing
      await expect(service.handleParcelRts(event)).resolves.not.toThrow();
      expect(emailProvider.send).toHaveBeenCalled();
    });
  });
});
