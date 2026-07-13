# Architecture and Product Map

## Runtime shape

```text
Browser/PWA
    |
Express API + React application
    |
Shared PostgreSQL database
    |
Tenant-scoped rows and external M-Pesa/eTIMS/SMS providers
```

The application uses shared code and a shared database. Tenant-aware tables are scoped by `tenantId`; nullable tenant IDs retain single-store/demo compatibility. This is cost-effective for early growth but means heavy tenants and full-database restores share operational impact.

## SaaS evolution

- Up to roughly 500 stores: managed PostgreSQL with tenant-aware indexes.
- At higher workload: separate large tenants or regional/workload shards.
- At large scale: evaluate database-per-tenant or distributed PostgreSQL based on measured isolation and restore requirements.

## Main screens

| Path | Purpose |
| --- | --- |
| `/home` | Public product, plans, and signup entry. |
| `/billing` | Subscription state, prorated mid-cycle upgrades, payment instructions, references, and history. |
| `/` | Store dashboard. |
| `/checkout` | Online/offline cashier checkout and reconciliation. |
| `/inventory` | Products, suppliers, purchasing, promotions, CSV, and labels. |
| `/analytics` | Store trends, performance, stock health, and exports. |
| `/customers` | Profiles, loyalty, credit, and repayments. |
| `/operations` | Shifts, cash, receipts, refunds, voids, and audit. |
| `/super-admin/*` | Platform overview, analytics, plans, subscriptions, and tenants. |

## API domains

- Platform: `/api/plans`, `/api/signup`, `/api/billing`, `/api/super-admin/*`.
- Authentication: `/api/auth/*`, `/api/bootstrap`.
- Checkout: `/api/orders/*`, `/api/mpesa/*`, `/api/promotions/*`.
- Customers: `/api/customers/*`.
- Operations: `/api/shifts/*`, `/api/audit-logs`.
- Catalog and purchasing: `/api/admin/*`, `/api/suppliers`, `/api/purchase-orders`.
- Stocktakes: `/api/stock-counts` snapshots expected stock, records counts, and posts audited variance adjustments transactionally.
- Branch inventory: `/api/stock-transfers` exposes per-branch balances and transactional transfers while `products.stockQuantity` remains the tenant-wide aggregate.
- Lot tracking: opted-in products receive batch/expiry records through purchase receiving, sell by FEFO, retain order-line lot allocations, and restore the original lots on refunds.
- Purchase returns reverse only unsold received stock (and the selected lot when applicable), then remain open until the supplier credit reference is confirmed.
- Reporting: `/api/reports/*`.
- Fiscal operations: `/api/etims/*`.
- Runtime: `/api/health`, `/api/site-map`.

Detailed request and response contracts live in [API_DOCUMENTATION.md](API_DOCUMENTATION.md).

## Architectural priorities

Keep tenant scoping explicit, perform financial writes transactionally, preserve immutable audit/receipt history, treat provider calls as retryable workflows, and move slow or unreliable external work to durable background jobs as the system scales.
