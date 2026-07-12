-- Track cumulative partial returns so an order line cannot be refunded twice.
-- CHECK constraints are NOT VALID so legacy production rows cannot block rollout;
-- PostgreSQL still enforces them for every row inserted or changed after rollout.
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_status_check;
ALTER TABLE orders ADD CONSTRAINT orders_status_check
  CHECK (status IN ('completed', 'partial_refund', 'voided', 'refunded')) NOT VALID;

ALTER TABLE order_items
  ADD COLUMN IF NOT EXISTS "refundedQuantity" DECIMAL(12, 3) NOT NULL DEFAULT 0;

ALTER TABLE order_items
  DROP CONSTRAINT IF EXISTS order_items_refunded_quantity_check;

ALTER TABLE order_items
  ADD CONSTRAINT order_items_refunded_quantity_check
  CHECK ("refundedQuantity" >= 0 AND "refundedQuantity" <= quantity) NOT VALID;

ALTER TABLE products
  DROP CONSTRAINT IF EXISTS products_stock_quantity_check;

ALTER TABLE products
  ADD CONSTRAINT products_stock_quantity_check
  CHECK ("stockQuantity" >= 0) NOT VALID;

ALTER TABLE promotions
  DROP CONSTRAINT IF EXISTS promotions_usage_check;

ALTER TABLE promotions
  ADD CONSTRAINT promotions_usage_check
  CHECK ("usedCount" >= 0 AND "maxUses" >= 0 AND ("maxUses" = 0 OR "usedCount" <= "maxUses")) NOT VALID;

-- Receipt numbers are sequential within a tenant. Preserve single-store NULL scope.
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_orderNumber_key;
DROP INDEX IF EXISTS orders_order_number;
CREATE UNIQUE INDEX IF NOT EXISTS ux_orders_scope_order_number
  ON orders ((COALESCE("tenantId"::text, 'single-store')), "orderNumber");

-- loyaltyPoints was introduced in the application model without a matching
-- PostgreSQL migration. Backfill existing customers before enforcing balances.
ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS "loyaltyPoints" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE customers
  DROP CONSTRAINT IF EXISTS customers_balances_check;

ALTER TABLE customers
  ADD CONSTRAINT customers_balances_check
  CHECK ("creditBalance" >= 0 AND "loyaltyPoints" >= 0) NOT VALID;
