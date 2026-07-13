import { BadRequestException } from '@nestjs/common';
import { PaymentController } from './payment.controller';
import { PaymentService } from './payment.service';

describe('PaymentController', () => {
  let paymentService: jest.Mocked<Pick<PaymentService, 'handleWebhookEvent'>>;
  let controller: PaymentController;

  beforeEach(() => {
    paymentService = { handleWebhookEvent: jest.fn() };
    controller = new PaymentController(paymentService as never);
  });

  it('delegates to PaymentService with the raw body and Stripe-Signature header', async () => {
    const rawBody = Buffer.from('{"id":"evt_1"}');
    paymentService.handleWebhookEvent.mockResolvedValue(undefined);

    await controller.handleWebhook({ rawBody } as never, 'sig_header');

    expect(paymentService.handleWebhookEvent).toHaveBeenCalledWith(
      rawBody,
      'sig_header',
    );
  });

  it('maps a signature-verification failure to 400 Bad Request', async () => {
    paymentService.handleWebhookEvent.mockRejectedValue(
      new Error('signature verification failed'),
    );

    await expect(
      controller.handleWebhook(
        { rawBody: Buffer.from('{}') } as never,
        'bad-sig',
      ),
    ).rejects.toThrow(BadRequestException);
  });
});
