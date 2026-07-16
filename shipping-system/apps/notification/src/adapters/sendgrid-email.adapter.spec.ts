import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { SendGridEmailAdapter } from './sendgrid-email.adapter';

describe('SendGridEmailAdapter', () => {
  let adapter: SendGridEmailAdapter;
  let fetchMock: jest.SpyInstance;

  const config: Record<string, string> = {
    SENDGRID_API_KEY: 'SG.test-key',
    SENDGRID_FROM_EMAIL: 'noreply@shipping.test',
    SENDGRID_TO_EMAIL: 'customer@shipping.test',
  };

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        SendGridEmailAdapter,
        {
          provide: ConfigService,
          useValue: { get: (key: string) => config[key] },
        },
      ],
    }).compile();

    adapter = moduleRef.get(SendGridEmailAdapter);
    fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      status: 202,
      text: () => Promise.resolve(''),
    } as Response);
  });

  afterEach(() => {
    fetchMock.mockRestore();
  });

  it('POSTs to the SendGrid v3 mail/send endpoint with the API key', async () => {
    await adapter.send('order-1', 'Subject A', 'Body A');

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.sendgrid.com/v3/mail/send');
    expect(init.method).toBe('POST');
    expect(init.headers).toEqual({
      Authorization: 'Bearer SG.test-key',
      'Content-Type': 'application/json',
    });
  });

  it('sends the subject, body, from and to addresses in the payload', async () => {
    await adapter.send('order-1', 'Subject A', 'Body A');

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const payload = JSON.parse(init.body as string) as {
      personalizations: { to: { email: string }[] }[];
      from: { email: string };
      subject: string;
      content: { type: string; value: string }[];
    };

    expect(payload.from.email).toBe('noreply@shipping.test');
    expect(payload.personalizations[0].to[0].email).toBe(
      'customer@shipping.test',
    );
    expect(payload.subject).toBe('Subject A');
    expect(payload.content[0]).toEqual({ type: 'text/plain', value: 'Body A' });
  });

  it('rejects when SendGrid responds with a non-2xx status', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 401,
      text: () => Promise.resolve('{"errors":[{"message":"unauthorized"}]}'),
    });

    await expect(adapter.send('order-1', 'S', 'B')).rejects.toThrow(
      'SendGrid responded 401',
    );
  });
});
