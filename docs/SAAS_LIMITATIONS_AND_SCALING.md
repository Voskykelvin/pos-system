# Multi-Tenant SaaS Architectural Analysis & Limitations Guide

This document provides a senior engineer's architectural evaluation of our current **Multi-Tenant Row-Level Scoped (`tenantId`) Architecture**, its trade-offs, limitations, and the scaling roadmap to 10,000+ stores.

---

## 🏛️ Current Architecture: Shared Database with Row-Level Isolation

Our system currently uses a **Shared-Database Shared-Schema Model**, where all subscriber businesses share a single PostgreSQL database, and data is strictly partitioned using indexed `tenantId` columns.

```
                  ┌──────────────────────────────────────────┐
                  │           Express POS Web Server         │
                  └────────────────────┬─────────────────────┘
                                       │
                    ┌──────────────────┴──────────────────┐
                    │      Shared PostgreSQL Database     │
                    ├─────────────────────────────────────┤
                    │ products (tenantId=StoreA)          │
                    │ products (tenantId=StoreB)          │
                    │ orders   (tenantId=StoreA)          │
                    │ orders   (tenantId=StoreB)          │
                    └─────────────────────────────────────┘
```

---

## ⚠️ Key Limitations & Trade-Offs

### 1. 📢 The "Noisy Neighbor" Effect
- **The Issue**: If Store A (a 50-cashier mega-supermarket) performs a heavy bulk CSV import or runs complex end-of-year analytics queries, it consumes CPU and disk IOPS on the shared database.
- **Impact**: Could introduce slight latency spikes (+50ms) for Store B when a cashier scans an item at checkout.
- **Mitigation Strategy**:
  - Add database query timeouts & connection pooling (`PgBouncer`).
  - Implement read-replicas for heavy reporting queries so checkouts hit the primary DB.

### 2. 🗄️ Point-in-Time Backup & Restore Granularity
- **The Issue**: Taking a PostgreSQL snapshot backs up all stores at once. If Store A accidentally deletes their product catalog and requests a database restore to "10:00 AM yesterday", restoring the entire PostgreSQL database snapshot would overwrite data for Store B and Store C.
- **Mitigation Strategy**:
  - Store-level data exports/imports (we implemented CSV backup in `ProductAdmin -> CSV Tools`).
  - Implement soft deletes (`deletedAt`) instead of hard SQL `DELETE` queries.

### 3. 🎨 Custom Attributes per Business Type
- **The Issue**: Hardware stores need "Dimensions & Weight", pharmacies need "Prescription Batch # & Expiry Date", and fashion boutiques need "Size & Color". Adding custom SQL columns for every industry would clutter the `products` table schema.
- **Mitigation Strategy**:
  - Use PostgreSQL `JSONB` columns (`metadata: DataTypes.JSONB`) on `Product` and `Order` models to store custom key-value pairs per industry.

---

## 🚀 Scaling & Growth Roadmap

| Subscriber Range | Architecture Recommended | Estimated Monthly Hosting Cost |
|---|---|---|
| **1 – 500 Stores** | Current Architecture (Single Managed Postgres + `tenantId` indexes) | $20 – $70 / month |
| **500 – 5,000 Stores** | Sharded Postgres (Split stores across 4 regional database clusters) | $150 – $400 / month |
| **5,000+ Stores** | Database-per-Tenant or Distributed SQL (CockroachDB / Citus / AWS Aurora) | $1,000+ / month |

---

## 🏁 Summary

For **0 to 500 paying stores**, the current architecture is the **gold standard**: it is ultra-cheap to host ($20/mo), extremely easy to migrate, highly performant (thanks to composite `tenantId` indexes), and delivers maximum profit margin for your SaaS business!
