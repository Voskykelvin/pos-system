-- Migration 002: Batch 5 Schema Additions
-- Creates loyalty_transactions and promotions tables, adds partial_refund to orders status check constraint

CREATE TABLE IF NOT EXISTS loyalty_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "customerId" UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    "orderId" UUID REFERENCES orders(id) ON DELETE SET NULL,
    type VARCHAR(20) NOT NULL CHECK (type IN ('earn', 'redeem', 'adjust')),
    points INTEGER NOT NULL,
    "balanceBefore" INTEGER NOT NULL,
    "balanceAfter" INTEGER NOT NULL,
    note VARCHAR(255),
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_loyalty_transactions_customer ON loyalty_transactions("customerId");
CREATE INDEX IF NOT EXISTS idx_loyalty_transactions_customer_created ON loyalty_transactions("customerId", "createdAt");

CREATE TABLE IF NOT EXISTS promotions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(50) NOT NULL UNIQUE,
    description VARCHAR(255),
    type VARCHAR(20) NOT NULL CHECK (type IN ('percent', 'fixed')),
    value DECIMAL(10, 2) NOT NULL,
    "minOrderTotal" DECIMAL(12, 2) DEFAULT 0,
    "maxUses" INTEGER DEFAULT 0,
    "usedCount" INTEGER NOT NULL DEFAULT 0,
    "startsAt" TIMESTAMPTZ,
    "expiresAt" TIMESTAMPTZ,
    "isActive" BOOLEAN DEFAULT true,
    "createdByUserId" UUID REFERENCES users(id) ON DELETE SET NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_promotions_code ON promotions(code);
CREATE INDEX IF NOT EXISTS idx_promotions_active ON promotions("isActive", "expiresAt");
