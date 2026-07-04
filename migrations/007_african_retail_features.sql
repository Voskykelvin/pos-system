-- Migration 007: African Retail Features (Debt Management, Multi-Tier Pricing, Petty Cash)

-- 1. Customer Debt Management
ALTER TABLE customers ADD COLUMN IF NOT EXISTS "creditLimit" DECIMAL(12, 2) NOT NULL DEFAULT 0.00;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS "creditBalance" DECIMAL(12, 2) NOT NULL DEFAULT 0.00;

CREATE TABLE IF NOT EXISTS customer_ledgers (
  id UUID PRIMARY KEY,
  "customerId" UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  "tenantId" UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  "orderId" UUID REFERENCES orders(id) ON DELETE SET NULL,
  type VARCHAR(50) NOT NULL, -- 'charge', 'payment'
  amount DECIMAL(12, 2) NOT NULL,
  "balanceAfter" DECIMAL(12, 2) NOT NULL,
  notes VARCHAR(255),
  "createdAt" TIMESTAMPTZ NOT NULL,
  "updatedAt" TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_customer_ledgers_customerId ON customer_ledgers("customerId");
CREATE INDEX IF NOT EXISTS idx_customer_ledgers_tenantId ON customer_ledgers("tenantId");

-- 2. Multi-Tier Pricing (Wholesale)
ALTER TABLE products ADD COLUMN IF NOT EXISTS "wholesalePrice" DECIMAL(12, 2);

-- 3. Shift Petty Cash Expenses
ALTER TABLE shifts ADD COLUMN IF NOT EXISTS "totalExpenses" DECIMAL(12, 2) NOT NULL DEFAULT 0.00;

CREATE TABLE IF NOT EXISTS expenses (
  id UUID PRIMARY KEY,
  amount DECIMAL(12, 2) NOT NULL,
  category VARCHAR(100) NOT NULL,
  description VARCHAR(255),
  "shiftId" UUID NOT NULL REFERENCES shifts(id) ON DELETE CASCADE,
  "cashierId" UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  "tenantId" UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  "createdAt" TIMESTAMPTZ NOT NULL,
  "updatedAt" TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_expenses_shiftId ON expenses("shiftId");
CREATE INDEX IF NOT EXISTS idx_expenses_tenantId ON expenses("tenantId");
