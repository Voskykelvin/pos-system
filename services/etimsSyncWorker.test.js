import { describe, expect, it } from 'vitest';
import etimsSyncWorker from './etimsSyncWorker';

const { retryDelayMilliseconds } = etimsSyncWorker;

describe('eTIMS retry schedule', () => {
  it('backs off exponentially and caps retries at thirty minutes', () => {
    expect(retryDelayMilliseconds(1)).toBe(30_000);
    expect(retryDelayMilliseconds(2)).toBe(60_000);
    expect(retryDelayMilliseconds(7)).toBe(1_800_000);
    expect(retryDelayMilliseconds(20)).toBe(1_800_000);
  });
});
