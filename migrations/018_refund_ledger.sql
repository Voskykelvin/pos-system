ALTER TABLE orders ADD COLUMN IF NOT EXISTS "refundedSubtotal" DECIMAL(12, 2) NOT NULL DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS "refundedTaxTotal" DECIMAL(12, 2) NOT NULL DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS "refundedDiscountTotal" DECIMAL(12, 2) NOT NULL DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS "refundedTotal" DECIMAL(12, 2) NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS order_refunds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "orderId" UUID NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,
  "tenantId" UUID REFERENCES tenants(id) ON DELETE RESTRICT,
  "userId" UUID REFERENCES users(id) ON DELETE SET NULL,
  type VARCHAR(20) NOT NULL CHECK (type IN ('partial', 'full')),
  subtotal DECIMAL(12, 2) NOT NULL DEFAULT 0 CHECK (subtotal >= 0),
  "taxTotal" DECIMAL(12, 2) NOT NULL DEFAULT 0 CHECK ("taxTotal" >= 0),
  "discountTotal" DECIMAL(12, 2) NOT NULL DEFAULT 0 CHECK ("discountTotal" >= 0),
  total DECIMAL(12, 2) NOT NULL CHECK (total >= 0),
  "tenderAllocations" JSONB NOT NULL DEFAULT '[]',
  reason VARCHAR(500),
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS order_refund_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "refundId" UUID NOT NULL REFERENCES order_refunds(id) ON DELETE RESTRICT,
  "orderItemId" UUID NOT NULL REFERENCES order_items(id) ON DELETE RESTRICT,
  "productId" UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  quantity DECIMAL(12, 3) NOT NULL CHECK (quantity > 0),
  "grossTotal" DECIMAL(12, 2) NOT NULL CHECK ("grossTotal" >= 0),
  "discountTotal" DECIMAL(12, 2) NOT NULL DEFAULT 0 CHECK ("discountTotal" >= 0),
  "taxTotal" DECIMAL(12, 2) NOT NULL DEFAULT 0 CHECK ("taxTotal" >= 0),
  total DECIMAL(12, 2) NOT NULL CHECK (total >= 0),
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_order_refunds_order_created ON order_refunds("orderId", "createdAt");
CREATE INDEX IF NOT EXISTS idx_order_refunds_tenant_created ON order_refunds("tenantId", "createdAt");
CREATE INDEX IF NOT EXISTS idx_order_refund_items_refund ON order_refund_items("refundId");
CREATE INDEX IF NOT EXISTS idx_order_refund_items_order_item ON order_refund_items("orderItemId");
CREATE INDEX IF NOT EXISTS idx_order_refund_items_product ON order_refund_items("productId");

ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_refunded_totals_check;
ALTER TABLE orders ADD CONSTRAINT orders_refunded_totals_check CHECK (
  "refundedSubtotal" >= 0 AND
  "refundedTaxTotal" >= 0 AND
  "refundedDiscountTotal" >= 0 AND
  "refundedTotal" >= 0 AND
  "refundedTotal" <= total
);
