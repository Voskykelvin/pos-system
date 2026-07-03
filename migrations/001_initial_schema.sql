-- =============================================================================
-- Migration 001: Initial Schema
-- Establishes all tables present at the end of Batch 2.
-- This migration is idempotent: each CREATE TABLE uses IF NOT EXISTS.
-- =============================================================================

-- Track which migrations have been applied.
CREATE TABLE IF NOT EXISTS schema_migrations (
  version     VARCHAR(100) PRIMARY KEY,
  applied_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- categories
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS categories (
  id           UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  name         VARCHAR(100) NOT NULL UNIQUE,
  "taxCategory" VARCHAR(20)  NOT NULL DEFAULT 'standard'
                             CHECK ("taxCategory" IN ('standard', 'zero_rated', 'exempt')),
  "createdAt"  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  "updatedAt"  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- products
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS products (
  id              UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  sku             VARCHAR(100)   NOT NULL UNIQUE,
  barcode         VARCHAR(100)   UNIQUE,
  name            VARCHAR(255)   NOT NULL,
  unit            VARCHAR(50)    NOT NULL DEFAULT 'each',
  "isWeighted"    BOOLEAN        NOT NULL DEFAULT FALSE,
  "costPrice"     NUMERIC(12,2)  NOT NULL DEFAULT 0,
  "sellingPrice"  NUMERIC(12,2)  NOT NULL,
  "reorderLevel"  INTEGER        NOT NULL DEFAULT 5,
  "stockQuantity" NUMERIC(12,3)  NOT NULL DEFAULT 0,
  "isActive"      BOOLEAN        NOT NULL DEFAULT TRUE,
  "categoryId"    UUID           NOT NULL REFERENCES categories(id),
  "createdAt"     TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  "updatedAt"     TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_products_barcode    ON products(barcode);
CREATE INDEX IF NOT EXISTS idx_products_sku        ON products(sku);
CREATE INDEX IF NOT EXISTS idx_products_category   ON products("categoryId");
CREATE INDEX IF NOT EXISTS idx_products_isactive   ON products("isActive");

-- ---------------------------------------------------------------------------
-- users
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id             UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  name           VARCHAR(255) NOT NULL,
  email          VARCHAR(255) UNIQUE,
  phone          VARCHAR(30)  UNIQUE,
  "passwordHash" VARCHAR(512) NOT NULL,
  role           VARCHAR(20)  NOT NULL DEFAULT 'cashier'
                              CHECK (role IN ('admin', 'manager', 'cashier')),
  "isActive"     BOOLEAN      NOT NULL DEFAULT TRUE,
  "createdAt"    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  "updatedAt"    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_email    ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_phone    ON users(phone);
CREATE INDEX IF NOT EXISTS idx_users_isactive ON users("isActive");

-- ---------------------------------------------------------------------------
-- customers
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS customers (
  id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  name        VARCHAR(255),
  phone       VARCHAR(30)  UNIQUE,
  email       VARCHAR(255) UNIQUE,
  "kraPin"    VARCHAR(50),
  "createdAt" TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone);

-- ---------------------------------------------------------------------------
-- orders
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS orders (
  id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  "orderNumber"   VARCHAR(50)   NOT NULL UNIQUE,
  "cashierId"     UUID          NOT NULL REFERENCES users(id),
  "customerId"    UUID          REFERENCES customers(id),
  subtotal        NUMERIC(12,2) NOT NULL,
  "taxTotal"      NUMERIC(12,2) NOT NULL DEFAULT 0,
  "discountTotal" NUMERIC(12,2) NOT NULL DEFAULT 0,
  total           NUMERIC(12,2) NOT NULL,
  status          VARCHAR(20)   NOT NULL DEFAULT 'completed'
                                CHECK (status IN ('completed', 'voided', 'refunded')),
  "paymentStatus" VARCHAR(20)   NOT NULL DEFAULT 'pending'
                                CHECK ("paymentStatus" IN ('pending','paid','partial','failed','reversed')),
  "createdAt"     TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  "updatedAt"     TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_orders_order_number         ON orders("orderNumber");
CREATE INDEX IF NOT EXISTS idx_orders_created_at           ON orders("createdAt");
CREATE INDEX IF NOT EXISTS idx_orders_cashier_created      ON orders("cashierId", "createdAt");
CREATE INDEX IF NOT EXISTS idx_orders_status_created       ON orders(status, "createdAt");

-- ---------------------------------------------------------------------------
-- order_items
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS order_items (
  id          UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  "orderId"   UUID          NOT NULL REFERENCES orders(id),
  "productId" UUID          NOT NULL REFERENCES products(id),
  quantity    NUMERIC(12,3) NOT NULL,
  "unitPrice" NUMERIC(12,2) NOT NULL,
  "taxRate"   NUMERIC(5,4)  NOT NULL DEFAULT 0,
  "lineTotal" NUMERIC(12,2) NOT NULL,
  "createdAt" TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_order_items_order   ON order_items("orderId");
CREATE INDEX IF NOT EXISTS idx_order_items_product ON order_items("productId");

-- ---------------------------------------------------------------------------
-- payments
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS payments (
  id                       UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  "orderId"                UUID          NOT NULL REFERENCES orders(id),
  method                   VARCHAR(20)   NOT NULL CHECK (method IN ('cash','mpesa','card')),
  amount                   NUMERIC(12,2) NOT NULL,
  status                   VARCHAR(20)   NOT NULL DEFAULT 'pending'
                                         CHECK (status IN ('pending','confirmed','failed','reversed')),
  "mpesaCheckoutRequestId" VARCHAR(100),
  "mpesaReceiptNumber"     VARCHAR(50),
  "mpesaPhone"             VARCHAR(30),
  "createdAt"              TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  "updatedAt"              TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payments_order                ON payments("orderId");
CREATE INDEX IF NOT EXISTS idx_payments_mpesa_checkout       ON payments("mpesaCheckoutRequestId");
CREATE INDEX IF NOT EXISTS idx_payments_order_method_status  ON payments("orderId", method, status);

-- ---------------------------------------------------------------------------
-- etims_invoices
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS etims_invoices (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  "orderId"   UUID        NOT NULL UNIQUE REFERENCES orders(id),
  status      VARCHAR(20) NOT NULL DEFAULT 'queued'
                          CHECK (status IN ('queued','transmitted','failed')),
  payload     JSONB       NOT NULL DEFAULT '{}',
  "retryCount" INTEGER    NOT NULL DEFAULT 0,
  "lastError"  TEXT,
  "transmittedAt" TIMESTAMPTZ,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_etims_status ON etims_invoices(status);

-- ---------------------------------------------------------------------------
-- audit_logs
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS audit_logs (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId"          UUID        REFERENCES users(id),
  action            VARCHAR(100) NOT NULL,
  "entityType"      VARCHAR(50),
  "entityId"        UUID,
  "approvedByUserId" UUID       REFERENCES users(id),
  metadata          JSONB       NOT NULL DEFAULT '{}',
  "createdAt"       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_user       ON audit_logs("userId");
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity     ON audit_logs("entityType", "entityId");
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs("createdAt");

-- ---------------------------------------------------------------------------
-- shifts
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS shifts (
  id                   UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  "cashierId"          UUID          NOT NULL REFERENCES users(id),
  "openedByUserId"     UUID          REFERENCES users(id),
  "closedByUserId"     UUID          REFERENCES users(id),
  status               VARCHAR(20)   NOT NULL DEFAULT 'open'
                                     CHECK (status IN ('open','closed')),
  "openingFloat"       NUMERIC(12,2) NOT NULL DEFAULT 0,
  "cashSalesExpected"  NUMERIC(12,2) NOT NULL DEFAULT 0,
  "cashCounted"        NUMERIC(12,2),
  "cashVariance"       NUMERIC(12,2),
  "openedAt"           TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  "closedAt"           TIMESTAMPTZ,
  note                 TEXT,
  "createdAt"          TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  "updatedAt"          TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_shifts_cashier        ON shifts("cashierId");
CREATE INDEX IF NOT EXISTS idx_shifts_status         ON shifts(status);
CREATE INDEX IF NOT EXISTS idx_shifts_cashier_status ON shifts("cashierId", status);

-- ---------------------------------------------------------------------------
-- inventory_transactions
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS inventory_transactions (
  id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  "productId"     UUID          NOT NULL REFERENCES products(id),
  type            VARCHAR(30)   NOT NULL CHECK (type IN ('purchase','sale','adjustment','wastage','return')),
  quantity        NUMERIC(12,3) NOT NULL,
  "balanceAfter"  NUMERIC(12,3) NOT NULL,
  "referenceType" VARCHAR(50),
  "referenceId"   UUID,
  "userId"        UUID          REFERENCES users(id),
  note            TEXT,
  "createdAt"     TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inv_txn_product         ON inventory_transactions("productId");
CREATE INDEX IF NOT EXISTS idx_inv_txn_product_created ON inventory_transactions("productId", "createdAt");
CREATE INDEX IF NOT EXISTS idx_inv_txn_type            ON inventory_transactions(type);
