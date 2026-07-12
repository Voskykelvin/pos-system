# Project Status and Roadmap

This is the single source of truth for shipped capabilities and planned product work. Code and automated tests take precedence if this document becomes stale.

## Current capabilities

- Mobile-first checkout with barcode/text search, held sales, customer lookup, promotions, loyalty, split tender, M-Pesa, credit, receipt printing, and offline cash-sale reconciliation.
- Transactional stock, promotion, loyalty, credit, idempotency, refund, void, receipt-number, and offline replay invariants.
- Product, category, supplier, purchasing, stock adjustment, CSV, barcode-label, and reorder workflows.
- Shift management, petty cash, cash reconciliation, receipt search, refund ledger, and audit review.
- Store analytics for sales trends, payments, categories, staff, customers, stock health, velocity, and restocking.
- Shared-database SaaS tenancy, public signup, plan enforcement, subscription review, billing-only access, and platform analytics.
- PWA installation, cached catalog, resilient offline queue, conflict handling, and device/sequence identity.
- Layered CI covering lint, 22 unit/component tests, API/workflow smoke tests, production build, Playwright checkout tests, and dependency audit.

## Completed modernization batches

1. Dependency, security, validation, CI, error handling, and request tracing hardening.
2. Responsive navigation, route splitting, error boundaries, design-system rules, and cashier typography improvements.
3. Database pooling, pagination, compression, query selection, health checks, and operational logging.
4. Analytics backend and UI across store and platform dashboards.
5. Financial and inventory invariants, persisted refund ledger, and net reporting.
6. Offline-sale identity, immutable envelopes, reconciliation, and authentication safety.
7. Phone checkout catalog/cart flow, persistent total bar, safe-area handling, and browser coverage.

## Remaining build batches

Work in this order unless a production incident changes priority:

1. Authentication and sessions: refresh rotation, device/session revocation, MFA, authorization tests, and standardized API errors.
2. Payment and fiscal resilience: persisted eTIMS claim leases and exponential retries are built; next add M-Pesa reconciliation, dead-letter operations, provider simulators, and credit notes.
3. PostgreSQL scale verification: PostgreSQL-backed CI, concurrency/contention tests, migration rollback tests, load tests, and distributed idempotency.
4. Observability and operations: centralized structured logs, error tracking, metrics, tracing, readiness checks, backup verification, and incident runbooks.
5. Performance and PWA: image compression, chart chunk reduction, font subsetting, smaller precache, and bundle budgets.
6. Broader mobile/accessibility work across inventory, reports, settings, and platform administration.
7. Advanced retail: transfers, cycle counts, batch/expiry tracking, exchanges, store credit, weighted scales, and deeper purchasing.
8. Provider certification using live Daraja, KRA eTIMS, and SMS accounts.

## External dependencies

Production certification requires business-controlled Render/PostgreSQL access, Daraja credentials and callback URL, KRA eTIMS registration and device credentials, optional Africa's Talking credentials, and a decision on automated SaaS subscription collection.
