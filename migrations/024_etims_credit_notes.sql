CREATE TABLE IF NOT EXISTS etims_credit_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "refundId" UUID NOT NULL UNIQUE REFERENCES order_refunds(id) ON DELETE RESTRICT,
  "orderId" UUID NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,
  "originalInvoiceId" UUID NOT NULL REFERENCES etims_invoices(id) ON DELETE RESTRICT,
  status VARCHAR(20) NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued','processing','transmitted','failed','cancelled')),
  payload JSONB NOT NULL DEFAULT '{}',
  "cuCreditNoteNumber" VARCHAR(100),
  "responsePayload" JSONB,
  "retryCount" INTEGER NOT NULL DEFAULT 0 CHECK ("retryCount" >= 0),
  "nextAttemptAt" TIMESTAMPTZ,
  "lockedAt" TIMESTAMPTZ,
  "lockToken" UUID,
  "transmittedAt" TIMESTAMPTZ,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_etims_credit_note_queue
  ON etims_credit_notes(status, "nextAttemptAt", "createdAt");
CREATE INDEX IF NOT EXISTS idx_etims_credit_note_order
  ON etims_credit_notes("orderId", "createdAt");
