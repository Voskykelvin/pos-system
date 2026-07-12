ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS "receivedBranchId" UUID REFERENCES branches(id) ON DELETE RESTRICT;
ALTER TABLE purchase_order_items ADD COLUMN IF NOT EXISTS "returnedQuantity" DECIMAL(12,3) NOT NULL DEFAULT 0;
ALTER TABLE purchase_order_items ADD CONSTRAINT purchase_order_items_returned_quantity_check
  CHECK ("returnedQuantity" >= 0 AND "returnedQuantity" <= "receivedQuantity");

ALTER TABLE inventory_transactions DROP CONSTRAINT IF EXISTS inventory_transactions_type_check;
ALTER TABLE inventory_transactions ADD CONSTRAINT inventory_transactions_type_check
  CHECK (type IN ('purchase','sale','adjustment','wastage','return','transfer_in','transfer_out','purchase_return'));

CREATE TABLE IF NOT EXISTS purchase_returns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenantId" UUID REFERENCES tenants(id) ON DELETE RESTRICT,
  "purchaseOrderId" UUID NOT NULL REFERENCES purchase_orders(id) ON DELETE RESTRICT,
  "supplierId" UUID NOT NULL REFERENCES suppliers(id) ON DELETE RESTRICT,
  "branchId" UUID REFERENCES branches(id) ON DELETE RESTRICT,
  status VARCHAR(30) NOT NULL DEFAULT 'awaiting_supplier_credit'
    CHECK (status IN ('awaiting_supplier_credit','credited','cancelled')),
  reason VARCHAR(500) NOT NULL,
  "totalCost" DECIMAL(12,2) NOT NULL DEFAULT 0 CHECK ("totalCost" >= 0),
  "createdByUserId" UUID REFERENCES users(id) ON DELETE SET NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS purchase_return_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "purchaseReturnId" UUID NOT NULL REFERENCES purchase_returns(id) ON DELETE RESTRICT,
  "purchaseOrderItemId" UUID NOT NULL REFERENCES purchase_order_items(id) ON DELETE RESTRICT,
  "productId" UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  "inventoryLotId" UUID REFERENCES inventory_lots(id) ON DELETE RESTRICT,
  quantity DECIMAL(12,3) NOT NULL CHECK (quantity > 0),
  "unitCost" DECIMAL(12,2) NOT NULL CHECK ("unitCost" >= 0),
  "lineTotal" DECIMAL(12,2) NOT NULL CHECK ("lineTotal" >= 0),
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_purchase_returns_tenant_created ON purchase_returns("tenantId", "createdAt");
CREATE INDEX IF NOT EXISTS idx_purchase_return_items_return ON purchase_return_items("purchaseReturnId");
