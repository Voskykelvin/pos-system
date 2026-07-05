-- Migration 015: Subscription billing MVP

ALTER TABLE tenants DROP CONSTRAINT IF EXISTS tenants_status_check;
ALTER TABLE tenants ALTER COLUMN status SET DEFAULT 'pending_payment';
ALTER TABLE tenants
  ADD CONSTRAINT tenants_status_check
  CHECK (status IN ('pending_payment', 'active', 'past_due', 'suspended'));

ALTER TABLE tenants ADD COLUMN IF NOT EXISTS "subscriptionStartedAt" TIMESTAMPTZ;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS "subscriptionEndsAt" TIMESTAMPTZ;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS "lastBillingReminderAt" TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_tenants_subscription_ends_at ON tenants("subscriptionEndsAt");

CREATE TABLE IF NOT EXISTS subscription_payments (
  id                  UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenantId"          UUID          NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  plan                VARCHAR(50)   NOT NULL,
  amount              NUMERIC(12,2) NOT NULL,
  currency            VARCHAR(10)   NOT NULL DEFAULT 'KES',
  method              VARCHAR(50)   NOT NULL DEFAULT 'mpesa_manual',
  status              VARCHAR(30)   NOT NULL DEFAULT 'pending',
  reference           VARCHAR(120)  NOT NULL,
  "payerName"         VARCHAR(255),
  "payerPhone"        VARCHAR(50),
  "submittedAt"       TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  "confirmedAt"       TIMESTAMPTZ,
  "rejectedAt"        TIMESTAMPTZ,
  "reviewedByUserId"  UUID          REFERENCES users(id) ON DELETE SET NULL,
  "periodStart"       TIMESTAMPTZ,
  "periodEnd"         TIMESTAMPTZ,
  notes               TEXT,
  "adminNotes"        TEXT,
  metadata            JSONB         NOT NULL DEFAULT '{}'::jsonb,
  "createdAt"         TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  "updatedAt"         TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  CONSTRAINT subscription_payments_status_check
    CHECK (status IN ('pending', 'confirmed', 'rejected', 'cancelled')),
  CONSTRAINT subscription_payments_method_check
    CHECK (method IN ('mpesa_manual', 'till_manual', 'paybill_manual', 'bank_transfer', 'card_gateway', 'other'))
);

CREATE INDEX IF NOT EXISTS idx_subscription_payments_tenant_status
  ON subscription_payments("tenantId", status);

CREATE INDEX IF NOT EXISTS idx_subscription_payments_reference
  ON subscription_payments(reference);

CREATE INDEX IF NOT EXISTS idx_subscription_payments_submitted_at
  ON subscription_payments("submittedAt");

CREATE INDEX IF NOT EXISTS idx_subscription_payments_period_end
  ON subscription_payments("periodEnd");
