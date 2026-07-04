# SaaS Architecture

The current SaaS direction is shared application code with a shared PostgreSQL database. Tenant-aware tables use a nullable `tenantId` so the same app can still run in single-store/demo mode.

## Current Shape

```
Browser clients
      |
Express API and React app
      |
Shared PostgreSQL database
      |
Rows scoped by tenantId when tenant context is present
```

Implemented pieces:

- `Tenant` and tenant-aware `User` records.
- Public signup that provisions a tenant, owner user, and default categories.
- Auth tokens that carry tenant context.
- Tenant-scoped admin, customer, inventory, purchasing, promotion, and operations queries where the request has a tenant.
- Platform owner dashboard for tenant status and plan oversight.

## Trade-Offs

- Shared database is low-cost and simple for early growth.
- Heavy reporting or imports from one large tenant can affect the same database used by other tenants.
- Store-specific point-in-time restore is hard because database snapshots restore all tenants together.
- More business-specific product fields should use `metadata` rather than repeated schema changes.

## Scaling Roadmap

| Subscriber Range | Recommended Shape | Notes |
| --- | --- | --- |
| 1-500 stores | Single managed Postgres with tenant indexes | Lowest operational cost. |
| 500-5,000 stores | Regional or workload-based Postgres shards | Split large tenants or regions. |
| 5,000+ stores | Database-per-tenant, Citus, CockroachDB, or Aurora-style partitioning | Higher cost, stronger isolation. |

## SaaS Product Follow-Up

- Add tenant-aware uniqueness for product SKU/barcode, customer phone, and promotion code.
- Add subscription billing and plan enforcement.
- Add tenant export/import and soft-delete restore workflows.
- Add per-tenant payment, tax, receipt, and localization configuration.
