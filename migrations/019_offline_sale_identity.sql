ALTER TABLE orders ADD COLUMN IF NOT EXISTS "offlineDeviceId" VARCHAR(100);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS "offlineSequence" BIGINT;

CREATE UNIQUE INDEX IF NOT EXISTS ux_orders_offline_device_sequence
  ON orders (
    (COALESCE("tenantId"::text, 'single-store')),
    "offlineDeviceId",
    "offlineSequence"
  )
  WHERE "offlineDeviceId" IS NOT NULL AND "offlineSequence" IS NOT NULL;
