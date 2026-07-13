'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawnSync } = require('child_process');
const { Client } = require('pg');

function option(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : null;
}

function connectionEnvironment(databaseUrl) {
  if (!databaseUrl) return {};
  const parsed = new URL(databaseUrl);
  return {
    PGHOST: parsed.hostname,
    PGPORT: parsed.port || '5432',
    PGUSER: decodeURIComponent(parsed.username),
    PGPASSWORD: decodeURIComponent(parsed.password),
    PGDATABASE: decodeURIComponent(parsed.pathname.replace(/^\//, ''))
  };
}

function runRestore(args, databaseUrl) {
  return spawnSync('pg_restore', args, {
    encoding: 'utf8',
    env: { ...process.env, ...connectionEnvironment(databaseUrl) }
  });
}

async function main() {
  if (process.argv.includes('--help')) {
    console.log('Usage: npm run db:verify-backup -- --file backups/jijenge.dump');
    return;
  }
  const fileArg = option('--file') || process.argv.slice(2).find((arg) => !arg.startsWith('--'));
  if (!fileArg) throw new Error('A backup file is required with --file.');
  const file = path.resolve(fileArg);
  const metadataFile = `${file}.metadata.json`;
  if (!fs.existsSync(file) || !fs.existsSync(metadataFile)) throw new Error('Backup or metadata file does not exist.');

  const contents = fs.readFileSync(file);
  const metadata = JSON.parse(fs.readFileSync(metadataFile, 'utf8'));
  const checksum = crypto.createHash('sha256').update(contents).digest('hex');
  if (checksum !== metadata.sha256 || contents.length !== metadata.bytes) {
    throw new Error('Backup checksum or size does not match its metadata.');
  }

  const listing = runRestore(['--list', file]);
  if (listing.error || listing.status !== 0) {
    throw new Error(listing.error?.code === 'ENOENT'
      ? 'pg_restore is not installed or not available on PATH.'
      : `pg_restore could not read the archive: ${listing.stderr}`);
  }

  const verifyUrl = process.env.BACKUP_VERIFY_DATABASE_URL;
  if (verifyUrl) {
    const databaseName = connectionEnvironment(verifyUrl).PGDATABASE;
    const restored = runRestore(['--exit-on-error', '--no-owner', '--no-acl', '--clean', '--if-exists', '--dbname', databaseName, file], verifyUrl);
    if (restored.error || restored.status !== 0) throw new Error(`Restore drill failed: ${restored.stderr}`);

    const client = new Client({ connectionString: verifyUrl, ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false });
    await client.connect();
    try {
      const required = ['orders', 'order_items', 'payments', 'inventory_transactions', 'schema_migrations'];
      const { rows } = await client.query(
        `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name = ANY($1::text[])`,
        [required]
      );
      const found = new Set(rows.map((row) => row.table_name));
      const missing = required.filter((table) => !found.has(table));
      if (missing.length) throw new Error(`Restored database is missing required tables: ${missing.join(', ')}`);
      const migrations = await client.query('SELECT COUNT(*)::int AS count FROM schema_migrations');
      if (Number(migrations.rows[0].count) < 1) throw new Error('Restored database has no migration history.');
    } finally {
      await client.end();
    }
  }

  console.log(`Backup verified: ${file}${verifyUrl ? ' (restore drill completed)' : ' (archive integrity only)'}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
