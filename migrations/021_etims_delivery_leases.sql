ALTER TABLE etims_invoices ADD COLUMN IF NOT EXISTS "nextAttemptAt" TIMESTAMPTZ;
ALTER TABLE etims_invoices ADD COLUMN IF NOT EXISTS "lockedAt" TIMESTAMPTZ;
ALTER TABLE etims_invoices ADD COLUMN IF NOT EXISTS "lockToken" UUID;

ALTER TABLE etims_invoices DROP CONSTRAINT IF EXISTS etims_invoices_status_check;
ALTER TABLE etims_invoices
  ADD CONSTRAINT etims_invoices_status_check
  CHECK (status IN ('queued','processing','transmitted','failed','cancelled'));

CREATE INDEX IF NOT EXISTS idx_etims_delivery_queue
  ON etims_invoices(status, "nextAttemptAt", "createdAt");
