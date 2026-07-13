import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import alertService from './alertService';

const { resetAlertDedupeForTests, sendOperationalAlert } = alertService;

describe('operational alerts', () => {
  beforeEach(() => {
    resetAlertDedupeForTests();
    process.env.ALERT_WEBHOOK_URL = 'https://alerts.example.test/hook';
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200 }));
  });

  afterEach(() => {
    delete process.env.ALERT_WEBHOOK_URL;
    vi.unstubAllGlobals();
  });

  it('dispatches a sanitized webhook payload', async () => {
    const result = await sendOperationalAlert({
      title: 'Cleanup\nfailed',
      message: 'Database\ttimeout',
      context: { job: 'retention' },
      dedupeKey: 'cleanup'
    });
    expect(result.sent).toBe(true);
    expect(fetch).toHaveBeenCalledTimes(1);
    const body = JSON.parse(fetch.mock.calls[0][1].body);
    expect(body.text).toContain('Cleanup failed');
    expect(body.text).toContain('Database timeout');
  });

  it('deduplicates repeated alerts inside the alert window', async () => {
    await sendOperationalAlert({ title: 'Failure', message: 'same', dedupeKey: 'same-key' });
    const result = await sendOperationalAlert({ title: 'Failure', message: 'same', dedupeKey: 'same-key' });
    expect(result.reason).toBe('deduplicated');
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
