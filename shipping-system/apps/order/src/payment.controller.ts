import {
  BadRequestException,
  Controller,
  Headers,
  HttpCode,
  Post,
  Req,
} from '@nestjs/common';
import { Request } from 'express';
import { PaymentService } from './payment.service';

interface RequestWithRawBody extends Request {
  rawBody: Buffer;
}

@Controller('payments')
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  @Post('webhook')
  @HttpCode(200)
  async handleWebhook(
    @Req() request: RequestWithRawBody,
    @Headers('stripe-signature') signature: string,
  ): Promise<void> {
    try {
      await this.paymentService.handleWebhookEvent(request.rawBody, signature);
    } catch (error) {
      throw new BadRequestException(
        `Webhook signature verification failed: ${(error as Error).message}`,
      );
    }
  }
}
