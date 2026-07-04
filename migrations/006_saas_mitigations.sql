-- Migration 006: Proactive SaaS Architecture Mitigations

-- Add JSONB metadata column for custom business/industry attributes
ALTER TABLE products ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

-- Add deletedAt columns for soft delete protection against accidental store wipes
ALTER TABLE products ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMPTZ;
ALTER TABLE categories ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMPTZ;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMPTZ;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMPTZ;

-- Performance indexes for soft delete filtering
CREATE INDEX IF NOT EXISTS idx_products_deletedAt ON products("deletedAt");
CREATE INDEX IF NOT EXISTS idx_orders_metadata ON orders USING gin(metadata);
