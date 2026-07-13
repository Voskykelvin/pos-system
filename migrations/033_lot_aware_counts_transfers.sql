ALTER TABLE stock_count_items
  ADD COLUMN IF NOT EXISTS "inventoryLotId" UUID REFERENCES inventory_lots(id) ON DELETE RESTRICT;

ALTER TABLE stock_count_items
  DROP CONSTRAINT IF EXISTS "stock_count_items_stockCountId_productId_key";

CREATE UNIQUE INDEX IF NOT EXISTS idx_stock_count_items_non_lot_unique
  ON stock_count_items("stockCountId", "productId")
  WHERE "inventoryLotId" IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_stock_count_items_lot_unique
  ON stock_count_items("stockCountId", "inventoryLotId")
  WHERE "inventoryLotId" IS NOT NULL;

ALTER TABLE stock_transfer_items
  ADD COLUMN IF NOT EXISTS "sourceInventoryLotId" UUID REFERENCES inventory_lots(id) ON DELETE RESTRICT;

ALTER TABLE stock_transfer_items
  ADD COLUMN IF NOT EXISTS "destinationInventoryLotId" UUID REFERENCES inventory_lots(id) ON DELETE RESTRICT;

ALTER TABLE stock_transfer_items
  DROP CONSTRAINT IF EXISTS stock_transfer_items_lot_pair_check;

ALTER TABLE stock_transfer_items
  ADD CONSTRAINT stock_transfer_items_lot_pair_check CHECK (
    ("sourceInventoryLotId" IS NULL AND "destinationInventoryLotId" IS NULL)
    OR
    ("sourceInventoryLotId" IS NOT NULL AND "destinationInventoryLotId" IS NOT NULL)
  );

ALTER TABLE stock_transfer_items
  DROP CONSTRAINT IF EXISTS "stock_transfer_items_stockTransferId_productId_key";

CREATE UNIQUE INDEX IF NOT EXISTS idx_stock_transfer_items_non_lot_unique
  ON stock_transfer_items("stockTransferId", "productId")
  WHERE "sourceInventoryLotId" IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_stock_transfer_items_lot_unique
  ON stock_transfer_items("stockTransferId", "sourceInventoryLotId")
  WHERE "sourceInventoryLotId" IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_stock_count_items_lot ON stock_count_items("inventoryLotId");
CREATE INDEX IF NOT EXISTS idx_stock_transfer_items_source_lot ON stock_transfer_items("sourceInventoryLotId");
CREATE INDEX IF NOT EXISTS idx_stock_transfer_items_destination_lot ON stock_transfer_items("destinationInventoryLotId");
