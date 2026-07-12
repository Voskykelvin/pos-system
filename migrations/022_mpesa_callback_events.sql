CREATE TABLE IF NOT EXISTS mpesa_callback_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "payloadHash" VARCHAR(64) NOT NULL UNIQUE,
  "checkoutRequestId" VARCHAR(100),
  "paymentId" UUID REFERENCES payments(id) ON DELETE SET NULL,
  "resultCode" INTEGER,
  status VARCHAR(30) NOT NULL DEFAULT 'received'
    CHECK (status IN ('received','processed','payment_failed','duplicate','unmatched','exception','error')),
  payload JSONB NOT NULL DEFAULT '{}',
  error TEXT,
  "deliveryCount" INTEGER NOT NULL DEFAULT 1 CHECK ("deliveryCount" > 0),
  "processedAt" TIMESTAMPTZ,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mpesa_callback_checkout
  ON mpesa_callback_events("checkoutRequestId", "createdAt");
CREATE INDEX IF NOT EXISTS idx_mpesa_callback_status
  ON mpesa_callback_events(status, "createdAt");
