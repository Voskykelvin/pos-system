/**
 * scripts/migrate-inline.js
 *
 * An in-process migration runner that can be called from server.js during
 * startup when DB_SYNC=true is set on a real Postgres database.
 *
 * Unlike scripts/migrate.js (which uses the raw pg Client directly),
 * this module uses the existing Sequelize connection so it integrates
 * cleanly with the server startup flow without opening a second connection.
 *
 * It reads the same /migrations/*.sql files and tracks applied versions
 * in the same schema_migrations table, so both runners are interoperable.
 */

'use strict';

const fs = require('fs');
const path = require('path');

const MIGRATIONS_DIR = path.join(__dirname, '..', 'migrations');

async function ensureMigrationsTable(sequelize) {
  await sequelize.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version     VARCHAR(100) PRIMARY KEY,
      applied_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
    )
  `);
}

async function getAppliedMigrations(sequelize) {
  const [rows] = await sequelize.query(
    'SELECT version FROM schema_migrations ORDER BY version ASC'
  );
  return new Set(rows.map((row) => row.version));
}

async function getMigrationFiles() {
  if (!fs.existsSync(MIGRATIONS_DIR)) {
    return [];
  }
  return fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((file) => file.endsWith('.sql'))
    .sort();
}

async function runMigrations(sequelize) {
  await ensureMigrationsTable(sequelize);

  const applied = await getAppliedMigrations(sequelize);
  const files = await getMigrationFiles();
  const pending = files.filter((f) => !applied.has(f));

  if (pending.length === 0) {
    console.log('Database migrations: up to date');
    return;
  }

  console.log(`Database migrations: applying ${pending.length} pending migration(s)...`);

  for (const file of pending) {
    const filePath = path.join(MIGRATIONS_DIR, file);
    const sql = fs.readFileSync(filePath, 'utf8');

    console.log(`  ▶ ${file}`);

    // Use a transaction so a failed migration does not leave partial state.
    const t = await sequelize.transaction();
    try {
      // Execute the migration SQL. We split on semicolons and run each
      // statement individually because Sequelize's query() doesn't support
      // multi-statement strings natively.
      const statements = sql
        .split(';')
        .map((s) => s.trim())
        .filter((s) => s.length > 0 && !s.startsWith('--'));

      for (const statement of statements) {
        await sequelize.query(statement, { transaction: t });
      }

      await sequelize.query(
        'INSERT INTO schema_migrations (version) VALUES (:version)',
        { replacements: { version: file }, transaction: t }
      );

      await t.commit();
      console.log(`  ✓ ${file}`);
    } catch (err) {
      await t.rollback();
      throw new Error(`Migration ${file} failed: ${err.message}`);
    }
  }

  console.log(`Database migrations: done`);
}

module.exports = { runMigrations };
