import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { ResendEmailAdapter } from './resend-email.adapter';

describe('ResendEmailAdapter', () => {
  let adapter: ResendEmailAdapter;
  let fetchMock: jest.SpyInstance;

  const config: Record<string, string> = {
    RESEND_API_KEY: 're_test-key',
    RESEND_TO_EMAIL: 'owner@shipping.test',
  };

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        ResendEmailAdapter,
        {
          provide: ConfigService,
          useValue: { get: (key: string) => config[key] },
        },
      ],
    }).compile();

    adapter = moduleRef.get(ResendEmailAdapter);
    fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      text: () => Promise.resolve('{"id":"email-id"}'),
    } as Response);
  });

  afterEach(() => {
    fetchMock.mockRestore();
  });

  it('POSTs to the Resend emails endpoint with the API key', async () => {
    await adapter.send('order-1', 'Subject A', 'Body A');

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.resend.com/emails');
    expect(init.method).toBe('POST');
    expect(init.headers).toEqual({
      Authorization: 'Bearer re_test-key',
      'Content-Type': 'application/json',
    });
  });

  it('defaults the from address to onboarding@resend.dev when RESEND_FROM_EMAIL is unset', async () => {
    await adapter.send('order-1', 'Subject A', 'Body A');

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const payload = JSON.parse(init.body as string) as {
      from: string;
      to: string[];
      subject: string;
      text: string;
    };

    expect(payload.from).toBe('onboarding@resend.dev');
    expect(payload.to).toEqual(['owner@shipping.test']);
    expect(payload.subject).toBe('Subject A');
    expect(payload.text).toBe('Body A');
  });

  it('rejects when Resend responds with a non-2xx status', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 403,
      text: () => Promise.resolve('{"message":"forbidden"}'),
    });

    await expect(adapter.send('order-1', 'S', 'B')).rejects.toThrow(
      'Resend responded 403',
    );
  });
});
