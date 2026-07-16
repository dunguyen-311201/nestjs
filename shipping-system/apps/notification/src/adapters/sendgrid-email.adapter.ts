import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IEmailProvider } from '../ports/email-provider.port';

const SENDGRID_SEND_URL = 'https://api.sendgrid.com/v3/mail/send';

@Injectable()
export class SendGridEmailAdapter implements IEmailProvider {
  private readonly logger = new Logger(SendGridEmailAdapter.name);

  constructor(private readonly configService: ConfigService) {}

  async send(
    referenceId: string,
    subject: string,
    body: string,
  ): Promise<void> {
    const apiKey = this.configService.get<string>('SENDGRID_API_KEY');
    const from = this.configService.get<string>('SENDGRID_FROM_EMAIL');
    const to = this.configService.get<string>('SENDGRID_TO_EMAIL');

    const response = await fetch(SENDGRID_SEND_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: to }] }],
        from: { email: from },
        subject,
        content: [{ type: 'text/plain', value: body }],
      }),
    });

    if (!response.ok) {
      const detail = await response.text();
      throw new Error(
        `SendGrid responded ${response.status} for ref ${referenceId}: ${detail}`,
      );
    }

    this.logger.log(`Email sent via SendGrid for ref ${referenceId}`);
  }
}
