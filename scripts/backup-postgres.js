'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawnSync } = require('child_process');

function option(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : null;
}

function fail(message) {
  console.error(message);
  process.exitCode = 1;
}

function connectionEnvironment(databaseUrl) {
  const parsed = new URL(databaseUrl);
  const sslMode = parsed.searchParams.get('sslmode') || (process.env.DB_SSL === 'true' ? 'require' : null);
  return {
    PGHOST: parsed.hostname,
    PGPORT: parsed.port || '5432',
    PGUSER: decodeURIComponent(parsed.username),
    PGPASSWORD: decodeURIComponent(parsed.password),
    PGDATABASE: decodeURIComponent(parsed.pathname.replace(/^\//, '')),
    ...(sslMode ? { PGSSLMODE: sslMode } : {})
  };
}

if (process.argv.includes('--help')) {
  console.log('Usage: npm run db:backup -- --output backups/jijenge.dump');
} else if (!process.env.DATABASE_URL) {
  fail('DATABASE_URL is required.');
} else {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const output = path.resolve(option('--output') || path.join('backups', `jijenge-${timestamp}.dump`));
  fs.mkdirSync(path.dirname(output), { recursive: true });

  const result = spawnSync('pg_dump', [
    '--format=custom',
    '--no-owner',
    '--no-acl',
    '--file', output
  ], {
    stdio: 'inherit',
    env: { ...process.env, ...connectionEnvironment(process.env.DATABASE_URL) }
  });

  if (result.error || result.status !== 0) {
    fail(result.error?.code === 'ENOENT'
      ? 'pg_dump is not installed or not available on PATH.'
      : `pg_dump failed with status ${result.status}.`);
  } else {
    const contents = fs.readFileSync(output);
    const metadata = {
      format: 'postgres-custom',
      createdAt: new Date().toISOString(),
      bytes: contents.length,
      sha256: crypto.createHash('sha256').update(contents).digest('hex'),
      applicationCommit: process.env.RENDER_GIT_COMMIT || process.env.GITHUB_SHA || 'local'
    };
    fs.writeFileSync(`${output}.metadata.json`, `${JSON.stringify(metadata, null, 2)}\n`, { mode: 0o600 });
    console.log(`Backup created: ${output}`);
    console.log(`Checksum: ${metadata.sha256}`);
  }
}
