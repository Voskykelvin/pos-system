# Jijenge POS

Jijenge POS is a Point of Sale (POS) and retail management system built with Node.js, Express, Sequelize ORM, and React (Vite). It supports queue-friendly checkout, multi-tender payments, subscription billing, inventory management, supplier purchase orders, sales analytics, eTIMS integration workflows, and multi-till shift reconciliation.

Built by **Kelvin O.** For a custom POS build or rollout support, call/WhatsApp **+254 703 920 254**.

---

## Features Delivered

### High-Speed Checkout & Payments
- Barcode scanner and fast substring text search.
- Split-Tender Multi-Payment UI (Cash + M-Pesa on the same order).
- Hold/park a current sale locally and recall it later so cashiers can keep serving the queue when a customer needs time.
- Customer Phone Lookup & Quick-Add inside checkout with automated loyalty point earnings.
- Promotions & Discount Code engine (`SAVE10`, percentage & flat KES off).
- M-Pesa STK push prompt trigger with real-time payment status polling.
- Idempotency key protection preventing double-charges on network retries.

### Inventory & Purchasing Depth
- Inventory sub-tabs: **Products**, **Suppliers**, **Purchase Orders**, **Reorder Suggestions**, **Promotions**, and **CSV Tools**.
- Supplier directory & Purchase Order receiving workflow (automatically updates product stock and cost prices).
- Sales Velocity Reorder Algorithm (`GET /api/reports/reorder-suggestions?days=30`) with one-click PO auto-generation.
- Bulk product catalog import & export via Excel-compatible CSVs.
- `costPrice` snapshotting on every order line item for accurate gross profit tracking over time.

### Security, Compliance & Data Safety
- Salted PBKDF2-SHA512 password hashes and signed bearer-token authentication with Role-Based Access Control (`admin`, `manager`, `cashier`).
- Schema validation middleware on core write endpoints, backed by controller and database constraints.
- Rate limiting (`express-rate-limit`: 10 auth attempts/15 min, 120 API calls/min) and `helmet` CSP security headers.
- Transactional SQL Migration Runner (`npm run db:migrate`) replacing unsafe `alter:true` syncs.
- eTIMS invoice queueing, automated retry worker, and transmitted invoice lock protection.
- Product-level Kenya VAT classification (`standard`, `zero_rated`, `exempt`) with setup notes in [`docs/KENYA_VAT_PRODUCT_CLASSIFICATION.md`](docs/KENYA_VAT_PRODUCT_CLASSIFICATION.md).
- Audit Log System recording all staff actions and manager approvals.

### Operations & Multi-Till Analytics
- Shift open/close with cash reconciliation.
- Today's Multi-Till Shift Summary for Managers aggregating floats, expected cash, counted cash, and variances across all registers.
- Line-item partial refunds and full voids with stock restoration.
- Printable thermal receipt view.
- Chart-driven analytics dashboard with sales trends, conversion, payment mix, staff performance, gross margin, stock alerts, and reorder recommendations.
- Platform owner dashboard with MRR, signup activation, store activity, tenant health, and Starter/Growth/Enterprise plan packaging.

### SaaS Subscription Billing
- Public signup creates a tenant account and routes unpaid stores to `/billing`.
- Manual M-Pesa phone, Till, PayBill, bank, or gateway instructions can be configured through `PLATFORM_*` environment variables.
- Store owners submit subscription payment references for super-admin verification.
- Super-admin can confirm or reject payment references, track subscriptions ending soon, and activate 30-day subscription periods.
- Pending, past-due, or suspended tenants can log in only to billing until payment is verified.

---

## Quick Start (Local Demo)

```bash
# 1. Install dependencies
npm install

# 2. Build frontend assets
npm run build

# 3. Start Jijenge POS server
npm start
```

Open `http://localhost:4000`.

> **Note**: If `DATABASE_URL` is omitted, the application automatically launches with an in-memory database pre-seeded with demo products, categories, suppliers, promo codes, and staff accounts!

### Demo Logins
- **Super Admin**: `superadmin@example.local` / `superadmin12345` unless overridden by `SUPER_ADMIN_EMAIL` and `SUPER_ADMIN_PASSWORD`
- **Admin**: `admin@example.local` / `admin12345`
- **Cashier**: `cashier@example.local` / `cashier12345`

---

## Development & Testing

```bash
# Run API & Vite frontend concurrently in development mode
npm run dev

# Run automated smoke test suite
npm run smoke
```

---

## Production Database Migrations

For PostgreSQL production deployments:

```bash
# Run pending SQL migrations
npm run db:migrate

# Preview pending migrations without applying
npm run db:migrate:dry
```

---

## Subscription Billing Setup

For the first launch phase, configure at least one platform collection channel:

```env
PLATFORM_BILLING_NAME=Jijenge POS
PLATFORM_MPESA_PHONE=
PLATFORM_MPESA_TILL=
PLATFORM_MPESA_PAYBILL=
PLATFORM_MPESA_ACCOUNT=
PLATFORM_BILLING_EMAIL=
PLATFORM_PAYMENT_GATEWAY=
```

The recommended Kenya rollout is manual M-Pesa first, then Till/PayBill, then Daraja STK Push or a gateway webhook when the business account is ready.

---

## Project Documentation

- [docs/PRODUCTION_READINESS.md](docs/PRODUCTION_READINESS.md) - Production Deployment & Runbook
- [docs/PILOT_LAUNCH_CHECKLIST.md](docs/PILOT_LAUNCH_CHECKLIST.md) - Controlled first-shop rollout checklist
- [docs/FEATURES_AND_ROADMAP.md](docs/FEATURES_AND_ROADMAP.md) - Built Features & Roadmap
- [docs/SAAS_ARCHITECTURE.md](docs/SAAS_ARCHITECTURE.md) - SaaS Architecture Notes
- [docs/SUBSCRIPTION_BILLING_MVP.md](docs/SUBSCRIPTION_BILLING_MVP.md) - Subscription billing product decision and rollout notes
- [docs/SITE_MAP.md](docs/SITE_MAP.md) - Screens and API map
- [docs/SECURITY_NOTES.md](docs/SECURITY_NOTES.md) - Security Audit & Hardening Notes
- [docs/IMPROVEMENT_SUMMARY.md](docs/IMPROVEMENT_SUMMARY.md) - Summary of completed project improvements and future roadmap
- [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) - Deployment Guide & Environment Variables
- [docs/INTEGRATION_GUIDE.md](docs/INTEGRATION_GUIDE.md) - M-Pesa, eTIMS, & Subscription Billing Integration Guide
- [docs/API_DOCUMENTATION.md](docs/API_DOCUMENTATION.md) - Main API Request & Response Schemas Guide
