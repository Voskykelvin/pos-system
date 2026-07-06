-- Store VAT classification at product level so broad categories like
-- "Groceries" do not accidentally charge VAT on zero-rated or exempt goods.

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS "taxCategory" VARCHAR(20);

UPDATE products AS p
SET "taxCategory" = COALESCE(p."taxCategory", c."taxCategory", 'standard')
FROM categories AS c
WHERE p."categoryId" = c.id
  AND p."taxCategory" IS NULL;

UPDATE products
SET "taxCategory" = COALESCE("taxCategory", 'standard')
WHERE "taxCategory" IS NULL;

DO $$
BEGIN
  ALTER TABLE products
    ADD CONSTRAINT products_tax_category_check
    CHECK ("taxCategory" IN ('standard', 'zero_rated', 'exempt'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE products
  ALTER COLUMN "taxCategory" SET DEFAULT 'standard',
  ALTER COLUMN "taxCategory" SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_products_tax_category
  ON products ("taxCategory");
