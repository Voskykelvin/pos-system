-- Track cumulative partial returns so an order line cannot be refunded twice.
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_status_check;
ALTER TABLE orders ADD CONSTRAINT orders_status_check
  CHECK (status IN ('completed', 'partial_refund', 'voided', 'refunded'));

ALTER TABLE order_items
  ADD COLUMN IF NOT EXISTS "refundedQuantity" DECIMAL(12, 3) NOT NULL DEFAULT 0;

ALTER TABLE order_items
  DROP CONSTRAINT IF EXISTS order_items_refunded_quantity_check;

ALTER TABLE order_items
  ADD CONSTRAINT order_items_refunded_quantity_check
  CHECK ("refundedQuantity" >= 0 AND "refundedQuantity" <= quantity);

ALTER TABLE products
  DROP CONSTRAINT IF EXISTS products_stock_quantity_check;

ALTER TABLE products
  ADD CONSTRAINT products_stock_quantity_check
  CHECK ("stockQuantity" >= 0);

ALTER TABLE promotions
  DROP CONSTRAINT IF EXISTS promotions_usage_check;

ALTER TABLE promotions
  ADD CONSTRAINT promotions_usage_check
  CHECK ("usedCount" >= 0 AND "maxUses" >= 0 AND ("maxUses" = 0 OR "usedCount" <= "maxUses"));

-- Receipt numbers are sequential within a tenant. Preserve single-store NULL scope.
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_orderNumber_key;
DROP INDEX IF EXISTS orders_order_number;
CREATE UNIQUE INDEX IF NOT EXISTS ux_orders_scope_order_number
  ON orders ((COALESCE("tenantId"::text, 'single-store')), "orderNumber");

ALTER TABLE customers
  DROP CONSTRAINT IF EXISTS customers_balances_check;

ALTER TABLE customers
  ADD CONSTRAINT customers_balances_check
  CHECK ("creditBalance" >= 0 AND "loyaltyPoints" >= 0);
