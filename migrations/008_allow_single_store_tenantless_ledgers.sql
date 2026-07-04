-- Migration 008: Keep single-store/demo mode compatible with tenant-aware tables

ALTER TABLE customer_ledgers ALTER COLUMN "tenantId" DROP NOT NULL;
ALTER TABLE expenses ALTER COLUMN "tenantId" DROP NOT NULL;
