import { TemplateData } from '#utils/mail'

export type EmailData = string | { name?: string; email: string }

export interface MailContent {
  type: string
  value: string
}

export enum MailTemplate {
  PAYMENT = 'payment',
  INVOICE = 'invoice',
  REGISTER = 'register-welcome',
}

export type MailData = {
  to: EmailData | EmailData[]
  from: EmailData
  text?: string
  html?: string
  templateId?: string
  subject?: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  dynamicTemplateData?: { [key: string]: any }
}

/**
 * Error class for email service failures
 */
export class EmailResponseError extends Error {
  code: number
  response: {
    headers: { [key: string]: string }
    body: string
  }

  constructor(
    message: string,
    code: number,
    response: { headers: { [key: string]: string }; body: string },
  ) {
    super(message)
    this.name = 'EmailResponseError'
    this.code = code
    this.response = response
  }
}

/**
 * Interface for email provider implementations
 */
export interface EmailProvider {
  sendWithTemplate(data: MailData): Promise<void>
  send(
    data: Omit<MailData, 'dynamicTemplateData'> & TemplateData,
  ): Promise<void>
}
