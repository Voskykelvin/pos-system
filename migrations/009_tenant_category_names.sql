-- Migration 009: Allow default category names to repeat across tenants

ALTER TABLE categories DROP CONSTRAINT IF EXISTS categories_name_key;
CREATE INDEX IF NOT EXISTS idx_categories_tenant_name ON categories("tenantId", name);
