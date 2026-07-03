-- Migration 003: Batch 3 Inventory Depth Schema Additions
-- Creates suppliers, purchase_orders, and purchase_order_items tables; adds costPrice to order_items

CREATE TABLE IF NOT EXISTS suppliers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    phone VARCHAR(50),
    address VARCHAR(255),
    "contactPerson" VARCHAR(255),
    "kraPin" VARCHAR(50),
    "isActive" BOOLEAN DEFAULT true,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_suppliers_name ON suppliers(name);

CREATE TABLE IF NOT EXISTS purchase_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "poNumber" VARCHAR(50) NOT NULL UNIQUE,
    "supplierId" UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
    status VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'ordered', 'received', 'cancelled')),
    "totalCost" DECIMAL(12, 2) NOT NULL DEFAULT 0,
    "expectedDelivery" TIMESTAMPTZ,
    "receivedAt" TIMESTAMPTZ,
    notes VARCHAR(255),
    "createdById" UUID REFERENCES users(id) ON DELETE SET NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_po_number ON purchase_orders("poNumber");
CREATE INDEX IF NOT EXISTS idx_po_supplier ON purchase_orders("supplierId");
CREATE INDEX IF NOT EXISTS idx_po_status ON purchase_orders(status);

CREATE TABLE IF NOT EXISTS purchase_order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "purchaseOrderId" UUID NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
    "productId" UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    "orderedQuantity" DECIMAL(12, 3) NOT NULL,
    "receivedQuantity" DECIMAL(12, 3) NOT NULL DEFAULT 0,
    "unitCostPrice" DECIMAL(12, 2) NOT NULL,
    "lineTotal" DECIMAL(12, 2) NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_poi_po ON purchase_order_items("purchaseOrderId");
CREATE INDEX IF NOT EXISTS idx_poi_product ON purchase_order_items("productId");

-- Add costPrice column to order_items if it doesn't exist
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS "costPrice" DECIMAL(12, 2) NOT NULL DEFAULT 0;
