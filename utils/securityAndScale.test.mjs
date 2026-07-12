import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const { codeAt, decryptSecret, encryptSecret, verifyCode } = require('./totp');
const { parseScaleBarcode } = require('./scaleBarcode');

function withEan13Checksum(firstTwelve) {
  const sum = firstTwelve.split('').reduce((total, digit, index) => (
    total + Number(digit) * (index % 2 === 0 ? 1 : 3)
  ), 0);
  return `${firstTwelve}${(10 - (sum % 10)) % 10}`;
}

describe('privileged authenticator secrets', () => {
  it('matches the RFC 6238 SHA-1 vector at 59 seconds', () => {
    const secret = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';
    expect(codeAt(secret, 59000)).toBe('287082');
    expect(verifyCode(secret, '287082', 59000)).toBe(true);
  });

  it('encrypts secrets with authenticated encryption', () => {
    const previous = process.env.MFA_ENCRYPTION_KEY;
    process.env.MFA_ENCRYPTION_KEY = 'test-key-that-is-not-used-in-production';
    try {
      const encrypted = encryptSecret('MFA-SECRET');
      expect(encrypted).not.toContain('MFA-SECRET');
      expect(decryptSecret(encrypted)).toBe('MFA-SECRET');
      const [iv, tag, ciphertext] = encrypted.split('.');
      const tamperedTag = `${tag[0] === 'A' ? 'B' : 'A'}${tag.slice(1)}`;
      expect(() => decryptSecret(`${iv}.${tamperedTag}.${ciphertext}`)).toThrow();
    } finally {
      if (previous === undefined) delete process.env.MFA_ENCRYPTION_KEY;
      else process.env.MFA_ENCRYPTION_KEY = previous;
    }
  });
});

describe('weighted EAN-13 labels', () => {
  it('extracts an allowed PLU and weight only with a valid checksum', () => {
    const barcode = withEan13Checksum('201234501250');
    expect(parseScaleBarcode(barcode)).toMatchObject({ scaleCode: '12345', quantity: 1.25 });
    expect(parseScaleBarcode(`${barcode.slice(0, -1)}${(Number(barcode[12]) + 1) % 10}`)).toBeNull();
  });

  it('rejects unconfigured prefixes and zero weights', () => {
    expect(parseScaleBarcode(withEan13Checksum('991234501250'))).toBeNull();
    expect(parseScaleBarcode(withEan13Checksum('201234500000'))).toBeNull();
  });
});
