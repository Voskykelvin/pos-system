# Project Status and Roadmap

This is the single source of truth for shipped capabilities and planned product work. Code and automated tests take precedence if this document becomes stale.

## Current capabilities

- Mobile-first checkout with barcode/text search, held sales, customer lookup, promotions, loyalty, split tender, M-Pesa, credit, receipt printing, and offline cash-sale reconciliation.
- Transactional stock, promotion, loyalty, credit, idempotency, refund, void, receipt-number, and offline replay invariants.
- Product, category, supplier, purchasing, stock adjustment, CSV, barcode-label, and reorder workflows.
- Scan-first product drafts with duplicate detection, optional catalogue enrichment, category matching, and tenant-unique SKU generation.
- Shift management, petty cash, cash reconciliation, receipt search, refund ledger, and audit review.
- Store analytics for sales trends, payments, categories, staff, customers, stock health, velocity, and restocking.
- Live analytics refresh with responsive trend, conversion, category, payment-mix, and operational KPI visualizations.
- Shared-database SaaS tenancy, public signup, plan enforcement, subscription review, billing-only access, and platform analytics.
- PWA installation, cached catalog, resilient offline queue, conflict handling, and device/sequence identity.
- Layered CI covering lint, unit/component tests, API/workflow smoke tests, PostgreSQL contention checks, production build and bundle budgets, Playwright checkout tests, and dependency audit.

## Completed modernization batches

1. Dependency, security, validation, CI, error handling, and request tracing hardening.
2. Responsive navigation, route splitting, error boundaries, design-system rules, and cashier typography improvements.
3. Database pooling, pagination, compression, query selection, health checks, and operational logging.
4. Analytics backend and UI across store and platform dashboards.
5. Financial and inventory invariants, persisted refund ledger, and net reporting.
6. Offline-sale identity, immutable envelopes, reconciliation, and authentication safety.
7. Phone checkout catalog/cart flow, persistent total bar, safe-area handling, and browser coverage.

## Remaining production and certification work

Work in this order unless a production incident changes priority:

1. Provider certification using live Daraja, KRA eTIMS, and SMS accounts; local M-Pesa/eTIMS simulators and durable credit-note queues are implemented.
2. Production operations: external error tracking, metrics/tracing backend, automated backup-restore drills, alert routing, and incident exercises.
3. Scale and resilience: load tests, migration rollback rehearsals, multi-instance idempotency/contention tests, and longer offline soak tests.
4. Advanced retail follow-through: lot-aware inter-branch transfers/counts, supplier remittance automation, and certified scale-device trials. Generic counts/transfers deliberately reject lot-tracked products to prevent balance drift.
5. Performance and accessibility: compress/replace the 2 MB marketing hero, subset or self-host fonts, automated accessibility scans, and broaden phone browser coverage beyond checkout.

## External dependencies

Production certification requires business-controlled Render/PostgreSQL access, Daraja credentials and callback URL, KRA eTIMS registration and device credentials, optional Africa's Talking credentials, and a decision on automated SaaS subscription collection.
