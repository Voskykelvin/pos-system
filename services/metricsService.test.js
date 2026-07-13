import { beforeEach, describe, expect, it } from 'vitest';
import metricsService from './metricsService';

const { beginRequest, recordRequest, renderPrometheus, resetMetricsForTests } = metricsService;

describe('Prometheus metrics', () => {
  beforeEach(() => resetMetricsForTests());

  it('records bounded route, status, and duration labels', async () => {
    beginRequest();
    recordRequest({ method: 'GET', baseUrl: '/api/orders', route: { path: '/:id' } }, 200, 120);
    const output = await renderPrometheus({ queuedEtims: 2, failedEtims: 1, unresolvedMpesa: 3, activeSessions: 4 });

    expect(output).toContain('jijenge_http_active_requests 0');
    expect(output).toContain('jijenge_http_requests_total{method="GET",route="/api/orders/:id",status="200"} 1');
    expect(output).toContain('jijenge_http_request_duration_ms_bucket{method="GET",route="/api/orders/:id",le="250"} 1');
    expect(output).toContain('jijenge_etims_pending_invoices 2');
    expect(output).toContain('jijenge_mpesa_unresolved_callbacks 3');
  });

  it('uses a single bounded label for unmatched routes', async () => {
    beginRequest();
    recordRequest({ method: 'DELETE', originalUrl: '/api/sessions/12345?all=true' }, 204, 10);
    const output = await renderPrometheus({ queuedEtims: 0, failedEtims: 0, unresolvedMpesa: 0, activeSessions: 0 });
    expect(output).toContain('route="/unmatched"');
    expect(output).not.toContain('12345');
  });
});
