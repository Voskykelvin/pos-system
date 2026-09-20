-- Keep operational audit history isolated between stores.
-- Legacy tenant-less rows remain available only to the single-store deployment.
ALTER TABLE audit_logs
  ADD COLUMN IF NOT EXISTS "tenantId" UUID REFERENCES tenants(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant_created
  ON audit_logs("tenantId", "createdAt" DESC);
