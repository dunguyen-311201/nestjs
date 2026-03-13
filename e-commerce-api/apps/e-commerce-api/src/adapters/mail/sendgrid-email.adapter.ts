import { FastifyBaseLogger } from 'fastify'

import { MailService } from '@sendgrid/mail'
import fs from 'node:fs'
import path from 'node:path'
import url from 'node:url'

import { TemplateData, getFrom, getTo, renderTemplate } from '#utils/mail'

import { EmailProvider, MailData } from '#types'

export class SendGridEmailAdapter implements EmailProvider {
  constructor(
    private mailer: MailService,
    private logger: FastifyBaseLogger,
  ) {}

  getHtmlFromTemplate = ({
    dynamicTemplateData,
    templateName,
  }: TemplateData) => {
    const __dirname = url.fileURLToPath(new URL('.', import.meta.url))
    const template = fs.readFileSync(
      path.join(__dirname, 'templates', `${templateName}.html`),
      'utf-8',
    )

    const html = renderTemplate(template, dynamicTemplateData)
    return html
  }

  async sendWithTemplate({
    to,
    from,
    templateId,
    dynamicTemplateData,
  }: MailData & Required<Pick<MailData, 'templateId'>>): Promise<void> {
    await this.mailer.send(
      { to, from, templateId, dynamicTemplateData },
      false,
      (error) => {
        if (error) {
          if ('response' in error) {
            this.logger.error(
              // eslint-disable-next-line @typescript-eslint/no-empty-object-type
              error.response.body as {},
              'Error - sendWithTemplate',
            )
          } else {
            this.logger.error(`Error - sendWithTemplate: ${error.message}`)
          }
        }
      },
    )
  }

  async send({
    subject,
    from,
    to,
    ...template
  }: MailData & TemplateData): Promise<void> {
    try {
      const html = this.getHtmlFromTemplate(template)

      await this.mailer.send({
        from: getFrom(from),
        to: getTo(to),
        subject,
        html: html!,
      })
      this.logger.info(
        { subject, from, to },
        `${template.templateName} - Email sent successfully`,
      )
    } catch (error) {
      this.logger.error(error, `Error to send ${template.templateName}`)
    }
  }
}
