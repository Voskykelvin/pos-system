'use strict';

const fs = require('fs');
const path = require('path');

function option(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : null;
}

async function capture(baseUrl, endpoint, headers = {}) {
  const startedAt = new Date().toISOString();
  try {
    const response = await fetch(`${baseUrl}${endpoint}`, { headers, signal: AbortSignal.timeout(10000) });
    const contentType = response.headers.get('content-type') || '';
    return {
      startedAt,
      status: response.status,
      ok: response.ok,
      body: contentType.includes('json') ? await response.json() : await response.text()
    };
  } catch (error) {
    return { startedAt, ok: false, error: error.message };
  }
}

async function main() {
  if (process.argv.includes('--help')) {
    console.log('Usage: npm run ops:snapshot -- --base-url https://pos.example.com');
    return;
  }
  const baseUrl = String(option('--base-url') || process.env.OPS_BASE_URL || 'http://localhost:4000').replace(/\/$/, '');
  const metricsHeaders = process.env.METRICS_TOKEN ? { Authorization: `Bearer ${process.env.METRICS_TOKEN}` } : {};
  const [live, ready, health, metrics] = await Promise.all([
    capture(baseUrl, '/api/live'),
    capture(baseUrl, '/api/ready'),
    capture(baseUrl, '/api/health'),
    capture(baseUrl, '/api/metrics', metricsHeaders)
  ]);
  const snapshot = { capturedAt: new Date().toISOString(), baseUrl, live, ready, health, metrics };
  const timestamp = snapshot.capturedAt.replace(/[:.]/g, '-');
  const output = path.resolve(option('--output') || path.join('incident-snapshots', `${timestamp}.json`));
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, `${JSON.stringify(snapshot, null, 2)}\n`, { mode: 0o600 });
  console.log(`Incident snapshot created: ${output}`);
  if (!live.ok || !ready.ok) process.exitCode = 2;
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
