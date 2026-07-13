'use strict';

function numberOption(name, fallback) {
  const prefix = `${name}=`;
  const value = process.argv.find((argument) => argument.startsWith(prefix))?.slice(prefix.length);
  return value ? Number(value) : fallback;
}

async function main() {
  if (process.argv.includes('--help')) {
    console.log('Usage: npm run test:load -- --base-url=http://localhost:4000 --requests=200 --concurrency=10 --max-p95=500');
    return;
  }
  const baseUrl = String(
    process.argv.find((argument) => argument.startsWith('--base-url='))?.split('=').slice(1).join('=') ||
    process.env.LOAD_BASE_URL ||
    'http://localhost:4000'
  ).replace(/\/$/, '');
  const target = new URL(baseUrl);
  const local = ['localhost', '127.0.0.1', '::1'].includes(target.hostname);
  if (!local && process.env.ALLOW_REMOTE_LOAD_TEST !== 'true') {
    throw new Error('Remote load tests require ALLOW_REMOTE_LOAD_TEST=true. Never target a system without authorization.');
  }

  const total = Math.max(1, numberOption('--requests', 200));
  const concurrency = Math.min(total, Math.max(1, numberOption('--concurrency', 10)));
  const maxP95 = Math.max(1, numberOption('--max-p95', 500));
  const durations = [];
  const failures = [];
  let cursor = 0;

  async function worker() {
    while (cursor < total) {
      const requestNumber = cursor++;
      const started = performance.now();
      try {
        const response = await fetch(`${baseUrl}/api/ready`, { signal: AbortSignal.timeout(5000) });
        const duration = performance.now() - started;
        durations.push(duration);
        if (!response.ok) failures.push({ requestNumber, status: response.status });
      } catch (error) {
        durations.push(performance.now() - started);
        failures.push({ requestNumber, error: error.message });
      }
    }
  }

  await Promise.all(Array.from({ length: concurrency }, () => worker()));
  durations.sort((a, b) => a - b);
  const percentile = (value) => durations[Math.min(durations.length - 1, Math.ceil(durations.length * value) - 1)];
  const result = {
    requests: total,
    concurrency,
    failures: failures.length,
    p50Ms: Number(percentile(0.5).toFixed(1)),
    p95Ms: Number(percentile(0.95).toFixed(1)),
    maxMs: Number(durations[durations.length - 1].toFixed(1))
  };
  console.log(JSON.stringify(result));
  if (failures.length || result.p95Ms > maxP95) {
    throw new Error(`Load smoke gate failed (failures=${failures.length}, p95=${result.p95Ms}ms, budget=${maxP95}ms).`);
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
