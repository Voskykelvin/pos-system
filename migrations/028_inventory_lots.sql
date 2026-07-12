ALTER TABLE products ADD COLUMN IF NOT EXISTS "tracksLots" BOOLEAN NOT NULL DEFAULT FALSE;

CREATE TABLE IF NOT EXISTS inventory_lots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenantId" UUID REFERENCES tenants(id) ON DELETE RESTRICT,
  "branchId" UUID REFERENCES branches(id) ON DELETE RESTRICT,
  "productId" UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  "supplierId" UUID REFERENCES suppliers(id) ON DELETE SET NULL,
  "purchaseOrderId" UUID REFERENCES purchase_orders(id) ON DELETE SET NULL,
  "lotNumber" VARCHAR(100) NOT NULL,
  "expiryDate" DATE,
  "receivedQuantity" DECIMAL(12,3) NOT NULL CHECK ("receivedQuantity" > 0),
  "availableQuantity" DECIMAL(12,3) NOT NULL CHECK ("availableQuantity" >= 0),
  "unitCost" DECIMAL(12,2) NOT NULL DEFAULT 0 CHECK ("unitCost" >= 0),
  "receivedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE("branchId", "productId", "lotNumber")
);

CREATE TABLE IF NOT EXISTS order_item_lot_allocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "orderItemId" UUID NOT NULL REFERENCES order_items(id) ON DELETE RESTRICT,
  "inventoryLotId" UUID NOT NULL REFERENCES inventory_lots(id) ON DELETE RESTRICT,
  quantity DECIMAL(12,3) NOT NULL CHECK (quantity > 0),
  "returnedQuantity" DECIMAL(12,3) NOT NULL DEFAULT 0 CHECK ("returnedQuantity" >= 0 AND "returnedQuantity" <= quantity),
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE("orderItemId", "inventoryLotId")
);

CREATE INDEX IF NOT EXISTS idx_inventory_lots_fefo
  ON inventory_lots("branchId", "productId", "expiryDate", "receivedAt")
  WHERE "availableQuantity" > 0;
CREATE INDEX IF NOT EXISTS idx_lot_allocations_order_item ON order_item_lot_allocations("orderItemId");
