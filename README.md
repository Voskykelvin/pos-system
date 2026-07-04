# Enterprise POS System

An enterprise-grade Point of Sale (POS) & Retail Management System built with Node.js, Express, Sequelize ORM, and React (Vite). Designed for high-speed checkout, multi-tender payments, inventory management, supplier purchase orders, sales velocity analytics, eTIMS tax compliance, and multi-till shift reconciliation.

---

## Features Delivered

### High-Speed Checkout & Payments
- Barcode scanner & instant fuzzy text search.
- Split-Tender Multi-Payment UI (Cash + M-Pesa on the same order).
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
- Hashed passwords (`bcrypt`) & signed JWT authentication with Role-Based Access Control (`admin`, `manager`, `cashier`).
- Schema validation middleware on all write endpoints.
- Rate limiting (`express-rate-limit`: 10 auth attempts/15 min, 120 API calls/min) and `helmet` CSP security headers.
- Transactional SQL Migration Runner (`npm run db:migrate`) replacing unsafe `alter:true` syncs.
- eTIMS invoice queueing, automated retry worker, and transmitted invoice lock protection.
- Audit Log System recording all staff actions and manager approvals.

### Operations & Multi-Till Analytics
- Shift open/close with cash reconciliation.
- Today's Multi-Till Shift Summary for Managers aggregating floats, expected cash, counted cash, and variances across all registers.
- Line-item partial refunds and full voids with stock restoration.
- Printable thermal receipt view.
- Real-time analytics dashboard with gross margin and stock alert reports.

---

## Quick Start (Local Demo)

```bash
# 1. Install dependencies
npm install

# 2. Build frontend assets
npm run build

# 3. Start POS server
npm start
```

Open `http://localhost:4000`.

> **Note**: If `DATABASE_URL` is omitted, the application automatically launches with an in-memory database pre-seeded with demo products, categories, suppliers, promo codes, and staff accounts!

### Demo Logins
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

## Project Documentation

- [docs/PRODUCTION_READINESS.md](docs/PRODUCTION_READINESS.md) - Production Deployment & Runbook
- [docs/FEATURES_AND_ROADMAP.md](docs/FEATURES_AND_ROADMAP.md) - Built Features & Roadmap
- [docs/SAAS_ARCHITECTURE.md](docs/SAAS_ARCHITECTURE.md) - SaaS Architecture Notes
- [docs/SECURITY_NOTES.md](docs/SECURITY_NOTES.md) - Security Audit & Hardening Notes
