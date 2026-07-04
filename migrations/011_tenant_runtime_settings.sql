-- Migration 011: Per-tenant runtime settings for credentials and receipt metadata

ALTER TABLE tenants ADD COLUMN IF NOT EXISTS settings JSONB NOT NULL DEFAULT '{}'::jsonb;
