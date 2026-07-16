import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IEmailProvider } from '../ports/email-provider.port';

const RESEND_SEND_URL = 'https://api.resend.com/emails';
const RESEND_SANDBOX_FROM = 'onboarding@resend.dev';

@Injectable()
export class ResendEmailAdapter implements IEmailProvider {
  private readonly logger = new Logger(ResendEmailAdapter.name);

  constructor(private readonly configService: ConfigService) {}

  async send(
    referenceId: string,
    subject: string,
    body: string,
  ): Promise<void> {
    const apiKey = this.configService.get<string>('RESEND_API_KEY');
    const from =
      this.configService.get<string>('RESEND_FROM_EMAIL') ??
      RESEND_SANDBOX_FROM;
    const to = this.configService.get<string>('RESEND_TO_EMAIL');

    const response = await fetch(RESEND_SEND_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from, to: [to], subject, text: body }),
    });

    if (!response.ok) {
      const detail = await response.text();
      throw new Error(
        `Resend responded ${response.status} for ref ${referenceId}: ${detail}`,
      );
    }

    this.logger.log(`Email sent via Resend for ref ${referenceId}`);
  }
}
