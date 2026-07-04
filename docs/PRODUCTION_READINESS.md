# Production Readiness Guide

This document tracks system readiness for production deployment on Render with Postgres.

---

## 🚀 Recommended Production Stack

- **Host**: Render Web Service (`npm install && npm run build` & `npm start`).
- **Database**: Managed Render PostgreSQL connected via `DATABASE_URL`.
- **Database Lifecycle**: Run `npm run db:migrate` at startup. (Safe transactional SQL migration runner).
- **Health Check**: `GET /api/health` returns `200 OK` with database connection state.
- **Provisioning Blueprint**: Included [`render.yaml`](file:///c:/Users/PC/OneDrive/Desktop/pos%20system/render.yaml) preconfigured for web service + managed database.

---

## ✅ Software Requirements Checklist (100% Complete)

| Requirement | Status | Solution Built |
|---|---|---|
| **Auth & RBAC** | ✅ Complete | JWT tokens, bcrypt hashing, role middleware (`admin`, `manager`, `cashier`) |
| **Manager Approval Controls** | ✅ Complete | Pin/Password approval service for voids, refunds, discounts & stock adjustments |
| **Database Migrations** | ✅ Complete | Transactional migration runner (`scripts/migrate.js`) replacing unsafe `alter:true` syncs |
| **Database Indexes** | ✅ Complete | Composite query indexes on `Order`, `OrderItem`, `Payment`, `EtimsInvoice`, `InventoryTransaction` |
| **Input Validation** | ✅ Complete | Schema validator (`middleware/validate.js`) on all write routes |
| **Idempotency Keys** | ✅ Complete | In-memory cache (`middleware/idempotency.js`) for Checkout & STK push calls |
| **Security Headers & Rate Limiting**| ✅ Complete | `helmet` CSP & `express-rate-limit` (10 auth attempts/15m, 120 API/m) |
| **Shift Management & Reconciliations**| ✅ Complete | Single-cashier shift open/close + Today's Multi-Till Shift Summary for Managers |
| **Supplier & Purchase Orders** | ✅ Complete | Supplier directory, PO receiving workflow, stock intake, cost price auto-updates |
| **Sales Velocity Reorder Suggestions** | ✅ Complete | 30-day velocity algorithm & auto-generate PO button |
| **CSV Data Import/Export** | ✅ Complete | One-click report export & bulk product catalog CSV import |
| **Customer Loyalty Engine** | ✅ Complete | Phone lookup, customer quick-add, 1 pt / KES 100 earn, points ledger |
| **Promotions & Promo Codes** | ✅ Complete | Percent/fixed promo codes, expiry limits, min order thresholds, admin management UI |
| **Line-Item Partial Refunds** | ✅ Complete | Itemized return UI & stock restoration logic |

---

## 🔒 Remaining Production Dependencies (Credential Setup)

Before triggering `git push` to Render production, configure the following environment parameters:

### 1. Database & Security
- `DATABASE_URL`: Production PostgreSQL connection string.
- `JWT_SECRET`: Generate a 64-character random secret.
- `BUSINESS_NAME`: e.g., "My Supermarket Ltd".
- `BUSINESS_KRA_PIN`: e.g., "P051234567Z".

### 2. M-Pesa Daraja Production (Safaricom)
- `MPESA_ENV`: `production`
- `MPESA_CONSUMER_KEY` & `MPESA_CONSUMER_SECRET`
- `MPESA_SHORTCODE` & `MPESA_PASSKEY`
- `MPESA_CALLBACK_URL`: `https://your-domain.onrender.com/api/mpesa/callback`

### 3. KRA eTIMS Integration
- `ETIMS_ENV`: `production`
- `ETIMS_BASE_URL` & `ETIMS_API_KEY`
- `ETIMS_DEVICE_SERIAL`: Device serial issued by KRA.
- `ENABLE_ETIMS_SCHEDULER`: `true`

---

## 📋 Production Deployment Runbook

1. **Provision Environment**:
   - Link repository to Render and apply [`render.yaml`](file:///c:/Users/PC/OneDrive/Desktop/pos%20system/render.yaml).
2. **Set Environment Variables**:
   - Input production keys in Render Secrets dashboard.
3. **Execute Initial Migration**:
   - Run `npm run db:migrate` via Render Shell or build command.
4. **Bootstrap Admin User**:
   - Run `npm run admin:create` via Render Shell to create the initial super-admin credentials.
5. **Verify Health**:
   - Confirm `GET https://your-app.onrender.com/api/health` returns `{ "ok": true, "database": "postgres" }`.
