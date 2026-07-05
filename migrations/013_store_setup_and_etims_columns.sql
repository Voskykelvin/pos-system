-- Migration 013: Store setup admin foundations and eTIMS column alignment

ALTER TABLE etims_invoices ADD COLUMN IF NOT EXISTS "cuInvoiceNumber" VARCHAR(100);
ALTER TABLE etims_invoices ADD COLUMN IF NOT EXISTS "qrCodeUrl" VARCHAR(500);
ALTER TABLE etims_invoices ADD COLUMN IF NOT EXISTS "responsePayload" JSONB;

ALTER TABLE etims_invoices DROP CONSTRAINT IF EXISTS etims_invoices_status_check;
ALTER TABLE etims_invoices
  ADD CONSTRAINT etims_invoices_status_check
  CHECK (status IN ('queued','transmitted','failed','cancelled'));

CREATE TABLE IF NOT EXISTS branches (
  id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenantId"  UUID         NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name        VARCHAR(255) NOT NULL,
  code        VARCHAR(50),
  phone       VARCHAR(50),
  address     VARCHAR(255),
  city        VARCHAR(100),
  "isActive"  BOOLEAN      NOT NULL DEFAULT TRUE,
  "createdAt" TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_branches_tenant ON branches("tenantId");
CREATE INDEX IF NOT EXISTS idx_branches_active ON branches("isActive");

CREATE UNIQUE INDEX IF NOT EXISTS ux_branches_tenant_name
  ON branches ("tenantId", lower(name));

CREATE UNIQUE INDEX IF NOT EXISTS ux_branches_tenant_code
  ON branches ("tenantId", lower(code))
  WHERE code IS NOT NULL;

ALTER TABLE users ADD COLUMN IF NOT EXISTS "branchId" UUID REFERENCES branches(id) ON DELETE SET NULL;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS "branchId" UUID REFERENCES branches(id) ON DELETE SET NULL;
ALTER TABLE shifts ADD COLUMN IF NOT EXISTS "branchId" UUID REFERENCES branches(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_users_branch ON users("branchId");
CREATE INDEX IF NOT EXISTS idx_orders_branch ON orders("branchId");
CREATE INDEX IF NOT EXISTS idx_shifts_branch ON shifts("branchId");
