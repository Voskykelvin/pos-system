# Project Status and Roadmap

This is the single source of truth for shipped capabilities and planned product work. Code and automated tests take precedence if this document becomes stale.

## Current capabilities

- Mobile-first checkout with barcode/text search, held sales, customer lookup, promotions, loyalty, split tender, M-Pesa, credit, receipt printing, and offline cash-sale reconciliation.
- Transactional stock, promotion, loyalty, credit, idempotency, refund, void, receipt-number, and offline replay invariants.
- Product, category, supplier, purchasing, stock adjustment, CSV, barcode-label, and reorder workflows.
- Scan-first product drafts from hardware scanners, phone cameras, or manual codes, with duplicate detection, optional catalogue enrichment, category matching, and tenant-unique SKU generation.
- Shift management, petty cash, cash reconciliation, receipt search, refund ledger, and audit review.
- Store analytics for sales trends, payments, categories, staff, customers, stock health, velocity, and restocking.
- Live analytics refresh with responsive trend, conversion, category, payment-mix, and operational KPI visualizations.
- Shared-database SaaS tenancy, public signup, plan enforcement, prorated mid-cycle upgrades, subscription review, billing-only access, and platform analytics.
- PWA installation, cached catalog, encrypted offline/held-sale storage, detailed conflict review, retained reconciliation notes, and device/sequence identity.
- Layered CI covering lint, unit/component tests, API/workflow smoke tests, PostgreSQL contention checks, production build and bundle budgets, Playwright checkout tests, and dependency audit.

## Completed modernization batches

1. Dependency, security, validation, CI, error handling, and request tracing hardening.
2. Responsive navigation, route splitting, error boundaries, design-system rules, and cashier typography improvements.
3. Database pooling, pagination, compression, query selection, health checks, and operational logging.
4. Analytics backend and UI across store and platform dashboards.
5. Financial and inventory invariants, persisted refund ledger, and net reporting.
6. Offline-sale identity, immutable envelopes, reconciliation, and authentication safety.
7. Phone checkout catalog/cart flow, persistent total bar, safe-area handling, and browser coverage.
8. Lot-aware inter-branch transfers and branch-selectable stock counts with lot/branch/tenant reconciliation.
9. Encrypted offline and held-sale payloads, memory-only bearer tokens, and operator-facing offline conflict reconciliation.
10. Token-protected Prometheus metrics, deduplicated webhook alerts, graceful process shutdown, incident snapshots, and checksum-backed PostgreSQL backup/restore drills in CI.
11. A 90% smaller marketing hero with an enforced asset budget, accessible chart names and skip navigation, automated Axe gates, and phone analytics coverage.

## Remaining production and certification work

Work in this order unless a production incident changes priority:

1. Provider certification using live Daraja, KRA eTIMS, and SMS accounts; local M-Pesa/eTIMS simulators and durable credit-note queues are implemented.
2. Connect the implemented metrics and alert webhooks to the selected monitoring provider, schedule encrypted off-site backups, and conduct a staffed incident exercise.
3. Scale and resilience: load tests, migration rollback rehearsals, multi-instance idempotency/contention tests, and longer offline soak tests.
4. Advanced retail follow-through: supplier remittance automation and certified scale-device trials.
5. Performance and accessibility follow-through: subset or self-host fonts, add manual screen-reader certification, and broaden real-device/browser coverage beyond Chromium.

## External dependencies

Production certification requires business-controlled Render/PostgreSQL access, Daraja credentials and callback URL, KRA eTIMS registration and device credentials, optional Africa's Talking credentials, and a decision on automated SaaS subscription collection.
