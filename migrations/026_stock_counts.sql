CREATE TABLE IF NOT EXISTS stock_counts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenantId" UUID REFERENCES tenants(id) ON DELETE RESTRICT,
  status VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','completed','cancelled')),
  note VARCHAR(500),
  "createdByUserId" UUID REFERENCES users(id) ON DELETE SET NULL,
  "completedByUserId" UUID REFERENCES users(id) ON DELETE SET NULL,
  "completedAt" TIMESTAMPTZ,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS stock_count_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "stockCountId" UUID NOT NULL REFERENCES stock_counts(id) ON DELETE CASCADE,
  "productId" UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  "expectedQuantity" DECIMAL(12,3) NOT NULL CHECK ("expectedQuantity" >= 0),
  "countedQuantity" DECIMAL(12,3) CHECK ("countedQuantity" >= 0),
  variance DECIMAL(12,3),
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE("stockCountId", "productId")
);

CREATE INDEX IF NOT EXISTS idx_stock_counts_tenant_status ON stock_counts("tenantId", status, "createdAt");
CREATE INDEX IF NOT EXISTS idx_stock_count_items_count ON stock_count_items("stockCountId");
