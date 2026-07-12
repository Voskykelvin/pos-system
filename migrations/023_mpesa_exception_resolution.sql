ALTER TABLE mpesa_callback_events ADD COLUMN IF NOT EXISTS resolution VARCHAR(30);
ALTER TABLE mpesa_callback_events ADD COLUMN IF NOT EXISTS "resolutionNote" VARCHAR(500);
ALTER TABLE mpesa_callback_events ADD COLUMN IF NOT EXISTS "resolvedByUserId" UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE mpesa_callback_events ADD COLUMN IF NOT EXISTS "resolvedAt" TIMESTAMPTZ;

ALTER TABLE mpesa_callback_events DROP CONSTRAINT IF EXISTS mpesa_callback_events_status_check;
ALTER TABLE mpesa_callback_events
  ADD CONSTRAINT mpesa_callback_events_status_check
  CHECK (status IN ('received','processed','payment_failed','duplicate','unmatched','exception','error','resolved'));

ALTER TABLE mpesa_callback_events DROP CONSTRAINT IF EXISTS mpesa_callback_events_resolution_check;
ALTER TABLE mpesa_callback_events
  ADD CONSTRAINT mpesa_callback_events_resolution_check
  CHECK (resolution IS NULL OR resolution IN ('confirmed_from_statement','dismissed'));
