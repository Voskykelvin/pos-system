# Testing Strategy

Jijenge POS uses layered automated checks. Fast tests protect calculations and UI behavior, API smoke tests exercise integrated business workflows, and Playwright validates the application through a real browser. A successful production build is required in CI alongside these test layers.

## Test Layers

### Unit and component tests

Vitest runs files matching `src/**/*.test.{js,jsx}` in jsdom. React Testing Library tests behavior through accessible labels and roles rather than component internals.

Current protected behavior includes:

- held-sale snapshots, queue limits, labels, ageing, and monetary rounding;
- VAT category normalization and product overrides;
- successful login submission and visible authentication errors.

Run once with `npm run test:unit`, or use `npm run test:unit:watch` while developing.

### API and workflow smoke tests

The smoke suite starts an isolated in-memory demo database and covers authentication, tenant administration, checkout, discounts, customer credit, shifts, receipts, refunds, stock, and fiscal guards. Run it with `npm run smoke`. `npm test` runs both unit/component tests and this smoke suite.

### Browser tests

Playwright builds and serves the production application against a fresh in-memory demo database. The suite currently verifies:

- cashier login and product search;
- a completed cash sale with correct change and receipt output;
- phone access to checkout navigation and sign out.

Install Chromium once with `npx playwright install chromium`, then run `npm run test:e2e`. Use `npm run test:e2e:run` only when `dist/` is already current. Failure screenshots, traces, and reports are generated in ignored test-output directories.

## Continuous Integration

GitHub Actions executes these gates for pushes and pull requests targeting `main`:

1. clean dependency installation;
2. ESLint;
3. unit and component tests;
4. production frontend build;
5. API and workflow smoke tests;
6. desktop and phone Chromium tests;
7. production dependency audit.

CI installs its own Chromium binary and does not depend on an external PostgreSQL instance or provider credentials.

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
5. offline queue conflicts, retries, and expired sessions;
6. M-Pesa callback replay, timeout, and reconciliation states;
7. migrations against empty and populated PostgreSQL databases;
8. accessibility scans and additional phone workflows.

Coverage percentages will become enforced after critical financial modules have meaningful tests. A high percentage without checkout, stock, payment, and refund invariants is not a sufficient quality gate.
