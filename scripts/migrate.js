/**
 * scripts/migrate.js
 *
 * Runs SQL migration files from the /migrations directory in version order.
 * Tracks applied migrations in a `schema_migrations` table so each file
 * runs exactly once.
 *
 * Usage:
 *   node scripts/migrate.js            - apply all pending migrations
 *   node scripts/migrate.js --dry-run  - list pending without applying
 *
 * Environment:
 *   DATABASE_URL  - required (Postgres connection string)
 *   DB_SSL        - 'true' to enable SSL with no self-signed rejection
 */

'use strict';

require('dotenv').config();

const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

const MIGRATIONS_DIR = path.join(__dirname, '..', 'migrations');
const DRY_RUN = process.argv.includes('--dry-run');

function getSslConfig() {
  if (process.env.DB_SSL === 'true') {
    return { require: true, rejectUnauthorized: false };
  }
  return false;
}

async function ensureMigrationsTable(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version     VARCHAR(100) PRIMARY KEY,
      applied_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
    )
  `);
}

async function getAppliedMigrations(client) {
  const result = await client.query(
    'SELECT version FROM schema_migrations ORDER BY version ASC'
  );
  return new Set(result.rows.map((row) => row.version));
}

async function getMigrationFiles() {
  if (!fs.existsSync(MIGRATIONS_DIR)) {
    console.log('No migrations directory found at', MIGRATIONS_DIR);
    return [];
  }

  return fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((file) => file.endsWith('.sql'))
    .sort(); // lexicographic sort - 001_*, 002_*, ... keeps order
}

async function applyMigration(client, file) {
  const filePath = path.join(MIGRATIONS_DIR, file);
  const sql = fs.readFileSync(filePath, 'utf8');

  console.log(`  > Applying ${file} ...`);

  // Run inside a transaction so a failed migration leaves no partial state.
  await client.query('BEGIN');
  try {
    await client.query(sql);
    await client.query(
      'INSERT INTO schema_migrations (version) VALUES ($1)',
      [file]
    );
    await client.query('COMMIT');
    console.log(`  OK ${file} applied`);
  } catch (err) {
    await client.query('ROLLBACK');
    throw new Error(`Migration ${file} failed: ${err.message}`);
  }
}

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error(
      'DATABASE_URL is not set. Migrations only apply to a real Postgres database.\n' +
      'The in-memory demo database is managed by Sequelize and does not use migrations.'
    );
    process.exit(1);
  }

  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: getSslConfig()
  });

  try {
    await client.connect();
    console.log('Connected to database');

    await ensureMigrationsTable(client);

    const applied = await getAppliedMigrations(client);
    const files = await getMigrationFiles();
    const pending = files.filter((f) => !applied.has(f));

    if (pending.length === 0) {
      console.log('All migrations are up to date.');
      return;
    }

    console.log(`\n${pending.length} pending migration(s):\n`);
    pending.forEach((f) => console.log('  -', f));

    if (DRY_RUN) {
      console.log('\n[dry-run] No changes were applied.');
      return;
    }

    console.log('');
    for (const file of pending) {
      await applyMigration(client, file);
    }

    console.log(`\nDone: ${pending.length} migration(s) applied successfully.`);
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error('\nMigration failed:', err.message);
  process.exit(1);
});
