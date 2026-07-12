ALTER TABLE customers ADD COLUMN IF NOT EXISTS "storeCreditBalance" DECIMAL(12,2) NOT NULL DEFAULT 0;
ALTER TABLE customers ADD CONSTRAINT customers_store_credit_balance_check CHECK ("storeCreditBalance" >= 0);

CREATE TABLE IF NOT EXISTS store_credit_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "customerId" UUID NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
  "tenantId" UUID REFERENCES tenants(id) ON DELETE RESTRICT,
  "orderId" UUID REFERENCES orders(id) ON DELETE SET NULL,
  "refundId" UUID REFERENCES order_refunds(id) ON DELETE SET NULL,
  type VARCHAR(20) NOT NULL CHECK (type IN ('issued','redeemed','adjustment')),
  amount DECIMAL(12,2) NOT NULL CHECK (amount <> 0),
  "balanceAfter" DECIMAL(12,2) NOT NULL CHECK ("balanceAfter" >= 0),
  note VARCHAR(500),
  "createdByUserId" UUID REFERENCES users(id) ON DELETE SET NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_method_check;
ALTER TABLE payments ADD CONSTRAINT payments_method_check CHECK (method IN ('cash','mpesa','card','credit','store_credit'));

CREATE INDEX IF NOT EXISTS idx_store_credit_customer_created ON store_credit_transactions("customerId", "createdAt");
CREATE INDEX IF NOT EXISTS idx_store_credit_tenant_created ON store_credit_transactions("tenantId", "createdAt");
