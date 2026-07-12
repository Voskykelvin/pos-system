ALTER TABLE products ADD COLUMN IF NOT EXISTS "scaleCode" VARCHAR(5);
CREATE UNIQUE INDEX IF NOT EXISTS ux_products_tenant_scale_code
  ON products((COALESCE("tenantId"::text, 'single-store')), "scaleCode")
  WHERE "scaleCode" IS NOT NULL;
