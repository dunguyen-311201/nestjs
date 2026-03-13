import { EmailData, MailTemplate } from '#types'

export const renderTemplate = (
  template: string,
  data: Record<string, unknown>,
) => {
  return template.replace(
    /{{(.*?)}}/g,
    (_, key) => (data[key.trim()] as string) ?? '',
  )
}

export const getFrom = (email: EmailData) =>
  typeof email === 'string' ? email : email.email

export const getTo = (to: EmailData | EmailData[]) =>
  Array.isArray(to) ? to.map(getFrom) : getFrom(to)

type PaymentData = {
  templateName: MailTemplate.PAYMENT
  dynamicTemplateData: {
    company_name: string
    invoice_id: string
    customer_name: string
    amount_due: string
    due_date: string
    invoice_url: string
    support_email: string
    help_center_url: string
    subject: string
  }
}

type InvoiceData = {
  templateName: MailTemplate.INVOICE
  dynamicTemplateData: {
    name: string
    email: string
    company_name: string
    amount_paid: string
    paid_date: string
    receipt_number: string
    invoice_number: string
    payment_method: string
    invoice_url: string
    receipt_url: string
    support_email: string
    items: {
      name: string
      quantity: number
      unit_price: string
      total: string
    }[]
  }
}

export type RegisterData = {
  templateName: MailTemplate.REGISTER
  dynamicTemplateData: {
    name: string
    email: string
    app_name: string
    logo_url: string
    login_url: string
    support_email: string
    year: number
  }
}

export type TemplateData = PaymentData | InvoiceData | RegisterData
