-- Migration 005: Multi-Tenant SaaS Schema Additions

CREATE TABLE IF NOT EXISTS tenants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) NOT NULL UNIQUE,
    currency VARCHAR(10) NOT NULL DEFAULT 'KES',
    country VARCHAR(10) NOT NULL DEFAULT 'KE',
    plan VARCHAR(20) NOT NULL DEFAULT 'starter' CHECK (plan IN ('starter', 'growth', 'enterprise')),
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'past_due', 'suspended')),
    "ownerUserId" UUID,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tenants_slug ON tenants(slug);
CREATE INDEX IF NOT EXISTS idx_tenants_status ON tenants(status);
CREATE INDEX IF NOT EXISTS idx_tenants_plan ON tenants(plan);

-- Add tenantId column to core tables
ALTER TABLE users ADD COLUMN IF NOT EXISTS "tenantId" UUID REFERENCES tenants(id) ON DELETE SET NULL;
ALTER TABLE products ADD COLUMN IF NOT EXISTS "tenantId" UUID REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE categories ADD COLUMN IF NOT EXISTS "tenantId" UUID REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS "tenantId" UUID REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS "tenantId" UUID REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE shifts ADD COLUMN IF NOT EXISTS "tenantId" UUID REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS "tenantId" UUID REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS "tenantId" UUID REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE promotions ADD COLUMN IF NOT EXISTS "tenantId" UUID REFERENCES tenants(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_users_tenant ON users("tenantId");
CREATE INDEX IF NOT EXISTS idx_products_tenant ON products("tenantId");
CREATE INDEX IF NOT EXISTS idx_orders_tenant ON orders("tenantId");
CREATE INDEX IF NOT EXISTS idx_customers_tenant ON customers("tenantId");
