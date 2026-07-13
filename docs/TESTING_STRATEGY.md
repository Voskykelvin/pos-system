# Testing Strategy

Jijenge POS uses layered automated checks. Fast tests protect calculations and UI behavior, API smoke tests exercise integrated business workflows, and Playwright validates the application through a real browser. A successful production build is required in CI alongside these test layers.

## Test Layers

### Unit and component tests

Vitest runs files matching `src/**/*.test.{js,jsx}` in jsdom. React Testing Library tests behavior through accessible labels and roles rather than component internals.

Current protected behavior includes:

- held-sale snapshots, queue limits, labels, ageing, and monetary rounding;
- VAT category normalization and product overrides;
- successful login submission and visible authentication errors.
- duplicate checkout-line consolidation and quantity precision;
- promotion checkout constraints and idempotency payload fingerprints.
- proportional refund tax/discount calculations and split-tender cent allocation.
- offline device sequencing, AES-GCM payload storage, immutable envelopes, authentication holds, conflict isolation, retained manager resolutions, and server replay identity.
- phone catalog/cart switching, persistent sale totals, cash tender, confirmation, and receipt visibility.
- RFC-compatible authenticator codes, encrypted MFA-secret round trips, and weighted EAN-13 checksum/quantity parsing.
- camera barcode decoding remains a lazy route dependency with a bundle budget and is excluded from the essential offline precache.
- bounded-cardinality Prometheus request metrics and operational-alert deduplication.

Run once with `npm run test:unit`, or use `npm run test:unit:watch` while developing.

### API and workflow smoke tests

The smoke suite starts an isolated in-memory demo database and covers authentication, tenant administration, checkout, discounts, customer credit, shifts, receipts, refund ledgers, net reporting, stock, fiscal guards, duplicate stock requests, promotion minimums, cumulative partial-refund limits, and lot-aware branch transfer/count reconciliation. The lot workflow proves that a product-only transfer is rejected and that lot, branch, and tenant balances remain aligned after count variance. Run it with `npm run smoke`. `npm test` runs both unit/component tests and this smoke suite.

### Browser tests

Playwright builds and serves the production application against a fresh in-memory demo database. The suite currently verifies:

- cashier login and product search;
- a completed cash sale with correct change and receipt output;
- phone access to checkout navigation and sign out.
- phone inventory camera controls and responsive live analytics without page overflow;
- automated WCAG A/AA scans of the public homepage and phone login, failing on serious or critical Axe findings.

Install Chromium once with `npx playwright install chromium`, then run `npm run test:e2e`. Use `npm run test:e2e:run` only when `dist/` is already current. Failure screenshots, traces, and reports are generated in ignored test-output directories.

## Continuous Integration

CI also provisions PostgreSQL 16, applies all migrations, verifies migration idempotency, checks required production tables, runs competing stock updates under `SELECT ... FOR UPDATE` locking, creates a custom-format backup, restores it into a disposable database, and verifies critical tables and migration history.

The production build is checked against route-level JavaScript budgets, and the large marketing hero is excluded from the offline till precache because it is not operationally required.

GitHub Actions executes these gates for pushes and pull requests targeting `main`:

1. clean dependency installation;
2. ESLint;
3. unit and component tests;
4. production frontend build;
5. API and workflow smoke tests;
6. desktop and phone Chromium tests;
7. production dependency audit.

CI installs its own Chromium binary and does not depend on an external PostgreSQL instance or provider credentials.

### Authorized load smoke

With a local production-style server running, `npm run test:load` sends 200 readiness requests at concurrency 10 and enforces a 500 ms p95 budget. Tune with `--requests=`, `--concurrency=`, and `--max-p95=`. Remote targets are blocked unless `ALLOW_REMOTE_LOAD_TEST=true`; use that override only with explicit authority and a planned traffic window. This bounded diagnostic does not replace sustained checkout/database contention testing.

## Test Data Rules

- Automated tests must never use production credentials or databases.
- Browser and smoke tests use deterministic accounts from `services/demoSeed.js`.
- Tests that mutate inventory or orders must use a database created for that test process.
- Time-dependent tests use explicit timestamps.
- Monetary assertions test rounding boundaries, not only whole-number examples.

## Next Coverage Priorities

The current foundation does not yet prove every production invariant. Next priorities are:

1. PostgreSQL checkout concurrency and atomic stock deduction;
2. duplicate idempotency requests under contention;
3. promotion usage limits and simultaneous redemption;
4. partial-refund concurrency and transaction rollback;
5. longer offline queue soak tests across browser restarts and storage-pressure conditions;
6. M-Pesa callback replay, timeout, and reconciliation states;
7. migrations against empty and populated PostgreSQL databases;
8. expand automated accessibility scans into authenticated data-heavy screens and add manual screen-reader certification.

Coverage percentages will become enforced after critical financial modules have meaningful tests. A high percentage without checkout, stock, payment, and refund invariants is not a sufficient quality gate.
