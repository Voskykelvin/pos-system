CREATE TABLE IF NOT EXISTS branch_inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "branchId" UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  "productId" UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  quantity DECIMAL(12,3) NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE("branchId", "productId")
);

ALTER TABLE stock_counts ADD COLUMN IF NOT EXISTS "branchId" UUID REFERENCES branches(id) ON DELETE RESTRICT;

INSERT INTO branch_inventory("branchId", "productId", quantity)
SELECT first_branch.id, product.id, product."stockQuantity"
FROM products product
JOIN LATERAL (
  SELECT branch.id
  FROM branches branch
  WHERE branch."tenantId" = product."tenantId"
  ORDER BY branch."createdAt" ASC, branch.id ASC
  LIMIT 1
) first_branch ON TRUE
WHERE product."tenantId" IS NOT NULL
ON CONFLICT ("branchId", "productId") DO NOTHING;

CREATE TABLE IF NOT EXISTS stock_transfers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenantId" UUID NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  "sourceBranchId" UUID NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  "destinationBranchId" UUID NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  status VARCHAR(20) NOT NULL DEFAULT 'completed' CHECK (status IN ('completed','cancelled')),
  note VARCHAR(500),
  "createdByUserId" UUID REFERENCES users(id) ON DELETE SET NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK ("sourceBranchId" <> "destinationBranchId")
);

CREATE TABLE IF NOT EXISTS stock_transfer_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "stockTransferId" UUID NOT NULL REFERENCES stock_transfers(id) ON DELETE RESTRICT,
  "productId" UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  quantity DECIMAL(12,3) NOT NULL CHECK (quantity > 0),
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE("stockTransferId", "productId")
);

ALTER TABLE inventory_transactions ADD COLUMN IF NOT EXISTS "branchId" UUID REFERENCES branches(id) ON DELETE SET NULL;
ALTER TABLE inventory_transactions DROP CONSTRAINT IF EXISTS inventory_transactions_type_check;
ALTER TABLE inventory_transactions ADD CONSTRAINT inventory_transactions_type_check
  CHECK (type IN ('purchase','sale','adjustment','wastage','return','transfer_in','transfer_out'));

CREATE INDEX IF NOT EXISTS idx_branch_inventory_product ON branch_inventory("productId", "branchId");
CREATE INDEX IF NOT EXISTS idx_stock_transfers_tenant_created ON stock_transfers("tenantId", "createdAt");
CREATE INDEX IF NOT EXISTS idx_inventory_transactions_branch ON inventory_transactions("branchId", "createdAt");
