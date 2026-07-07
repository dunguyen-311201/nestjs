import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;

function getKey(): Buffer {
  const hexKey = process.env.PII_ENCRYPTION_KEY;
  if (!hexKey) {
    throw new Error('PII_ENCRYPTION_KEY environment variable is not set');
  }
  const key = Buffer.from(hexKey, 'hex');
  if (key.length !== 32) {
    throw new Error(
      'PII_ENCRYPTION_KEY must be a 64-character hex string (32 bytes)',
    );
  }
  return key;
}

/**
 * Encrypts a PII field with AES-256-GCM. Output is `iv:authTag:ciphertext`,
 * each part hex-encoded. A fresh random IV is generated per call, so
 * encrypting the same plaintext twice never produces the same ciphertext.
 */
export function encrypt(plaintext: string): string {
  const key = getKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
}

/**
 * Decrypts a value produced by `encrypt`. Throws if the ciphertext was
 * tampered with (GCM auth tag mismatch) rather than returning garbage.
 */
export function decrypt(ciphertext: string): string {
  const key = getKey();
  const parts = ciphertext.split(':');
  if (parts.length !== 3) {
    throw new Error('Malformed ciphertext: expected "iv:authTag:ciphertext"');
  }
  const [ivHex, authTagHex, encryptedHex] = parts;
  const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encryptedHex, 'hex')),
    decipher.final(),
  ]);
  return decrypted.toString('utf8');
}
