'use strict';

const assert = require('assert');
const { Client } = require('pg');

async function sellWithLock(client, productId, quantity) {
  await client.query('BEGIN');
  try {
    const result = await client.query(
      'SELECT "stockQuantity" FROM products WHERE id = $1 FOR UPDATE',
      [productId]
    );
    const stock = Number(result.rows[0].stockQuantity);
    if (stock < quantity) {
      await client.query('ROLLBACK');
      return false;
    }
    await client.query(
      'UPDATE products SET "stockQuantity" = "stockQuantity" - $1 WHERE id = $2',
      [quantity, productId]
    );
    await client.query('COMMIT');
    return true;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  }
}

async function main() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');
  const admin = new Client({ connectionString: process.env.DATABASE_URL });
  const workerA = new Client({ connectionString: process.env.DATABASE_URL });
  const workerB = new Client({ connectionString: process.env.DATABASE_URL });
  await Promise.all([admin.connect(), workerA.connect(), workerB.connect()]);
  const suffix = Date.now();
  let categoryId;
  let productId;
  try {
    const migrations = await admin.query('SELECT COUNT(*)::int AS count FROM schema_migrations');
    assert(migrations.rows[0].count >= 32, 'Expected every SQL migration to be recorded');

    const category = await admin.query(
      'INSERT INTO categories(name, "taxCategory") VALUES ($1, $2) RETURNING id',
      [`Concurrency ${suffix}`, 'standard']
    );
    categoryId = category.rows[0].id;
    const product = await admin.query(
      `INSERT INTO products(sku, name, "sellingPrice", "stockQuantity", "categoryId")
       VALUES ($1, $2, 100, 10, $3) RETURNING id`,
      [`LOCK-${suffix}`, 'Lock Test Product', categoryId]
    );
    productId = product.rows[0].id;

    const outcomes = await Promise.all([
      sellWithLock(workerA, productId, 7),
      sellWithLock(workerB, productId, 7)
    ]);
    assert.equal(outcomes.filter(Boolean).length, 1, 'Exactly one competing sale must succeed');
    const finalStock = await admin.query('SELECT "stockQuantity" FROM products WHERE id = $1', [productId]);
    assert.equal(Number(finalStock.rows[0].stockQuantity), 3, 'Stock must never become negative');

    const requiredTables = ['auth_sessions', 'mpesa_callback_events', 'etims_credit_notes'];
    for (const table of requiredTables) {
      const result = await admin.query('SELECT to_regclass($1) AS name', [`public.${table}`]);
      assert(result.rows[0].name, `Missing production table ${table}`);
    }
    console.log('PostgreSQL migration and contention checks passed');
  } finally {
    if (productId) await admin.query('DELETE FROM products WHERE id = $1', [productId]);
    if (categoryId) await admin.query('DELETE FROM categories WHERE id = $1', [categoryId]);
    await Promise.all([admin.end(), workerA.end(), workerB.end()]);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
