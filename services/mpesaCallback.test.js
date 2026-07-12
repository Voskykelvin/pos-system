import { describe, expect, it } from 'vitest';
import mpesaCallback from './mpesaCallback';

const { callbackPayloadHash, validateCallbackAmount } = mpesaCallback;

describe('M-Pesa callback reconciliation', () => {
  it('creates a stable fingerprint for exact provider retries', () => {
    const payload = { Body: { stkCallback: { CheckoutRequestID: 'ws_CO_1', ResultCode: 0 } } };
    expect(callbackPayloadHash(payload)).toBe(callbackPayloadHash(payload));
    expect(callbackPayloadHash(payload)).not.toBe(callbackPayloadHash({ ...payload, retry: true }));
  });

  it('accepts equal monetary representations but quarantines missing or mismatched amounts', () => {
    expect(validateCallbackAmount('100.00', 100).valid).toBe(true);
    expect(validateCallbackAmount(99.99, 100).valid).toBe(false);
    expect(validateCallbackAmount(99.98, 100).valid).toBe(false);
    expect(validateCallbackAmount(undefined, 100).valid).toBe(false);
  });
});
