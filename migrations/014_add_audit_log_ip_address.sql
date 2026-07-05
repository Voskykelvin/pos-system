-- Migration 014: Align audit log table with the AuditLog Sequelize model

ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS "ipAddress" VARCHAR(100);

CREATE INDEX IF NOT EXISTS idx_audit_logs_ip_address ON audit_logs("ipAddress");
