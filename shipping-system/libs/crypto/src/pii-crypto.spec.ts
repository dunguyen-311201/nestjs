import { encrypt, decrypt } from './pii-crypto';

const TEST_KEY = '0'.repeat(64); // 32-byte hex key for AES-256

describe('pii-crypto', () => {
  const originalEnv = process.env.PII_ENCRYPTION_KEY;

  beforeAll(() => {
    process.env.PII_ENCRYPTION_KEY = TEST_KEY;
  });

  afterAll(() => {
    process.env.PII_ENCRYPTION_KEY = originalEnv;
  });

  it('round-trips: decrypt(encrypt(x)) === x', () => {
    const plaintext = 'Nguyen Van A';
    const ciphertext = encrypt(plaintext);
    expect(decrypt(ciphertext)).toBe(plaintext);
  });

  it('produces a different ciphertext each time (random IV)', () => {
    const plaintext = '+84901234567';
    const first = encrypt(plaintext);
    const second = encrypt(plaintext);
    expect(first).not.toBe(second);
    expect(decrypt(first)).toBe(plaintext);
    expect(decrypt(second)).toBe(plaintext);
  });

  it('throws instead of returning garbage when ciphertext is tampered with', () => {
    const ciphertext = encrypt('123 Le Loi Street');
    const tampered =
      ciphertext.slice(0, -2) + (ciphertext.slice(-2) === 'AA' ? 'BB' : 'AA');
    expect(() => decrypt(tampered)).toThrow();
  });

  it('throws if PII_ENCRYPTION_KEY is missing', () => {
    delete process.env.PII_ENCRYPTION_KEY;
    expect(() => encrypt('x')).toThrow();
    process.env.PII_ENCRYPTION_KEY = TEST_KEY;
  });
});
