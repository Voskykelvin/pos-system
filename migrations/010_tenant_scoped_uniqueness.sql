-- Migration 010: Tenant-scoped uniqueness for SaaS catalog and customer data

ALTER TABLE products DROP CONSTRAINT IF EXISTS products_sku_key;
ALTER TABLE products DROP CONSTRAINT IF EXISTS products_barcode_key;
ALTER TABLE customers DROP CONSTRAINT IF EXISTS customers_phone_key;
ALTER TABLE promotions DROP CONSTRAINT IF EXISTS promotions_code_key;

CREATE UNIQUE INDEX IF NOT EXISTS ux_products_scope_sku_active
  ON products ((COALESCE("tenantId"::text, 'single-store')), lower(sku))
  WHERE "deletedAt" IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ux_products_scope_barcode_active
  ON products ((COALESCE("tenantId"::text, 'single-store')), lower(barcode))
  WHERE barcode IS NOT NULL AND "deletedAt" IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ux_customers_scope_phone_active
  ON customers ((COALESCE("tenantId"::text, 'single-store')), phone)
  WHERE phone IS NOT NULL AND "deletedAt" IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ux_promotions_scope_code
  ON promotions ((COALESCE("tenantId"::text, 'single-store')), lower(code));
