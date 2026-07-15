import { Injectable, Logger } from '@nestjs/common';
import { IEmailProvider } from '../ports/email-provider.port';

@Injectable()
export class LoggingEmailAdapter implements IEmailProvider {
  private readonly logger = new Logger(LoggingEmailAdapter.name);

  send(referenceId: string, subject: string, body: string): Promise<void> {
    this.logger.log(
      `[EMAIL EMULATOR] Would send email for ref ${referenceId} | Subject: "${subject}" | Body: "${body}"`,
    );
    return Promise.resolve();
  }
}
