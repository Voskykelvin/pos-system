# Features And Roadmap

This document replaces the old launch-batch and build-roadmap notes. It records what is currently built and what still depends on external credentials or business setup.

## Built Capabilities

### Checkout And Payments
- Staff login with role-based navigation for admin, manager, cashier, and platform owner users.
- Barcode and text product search with offline catalog cache.
- Split tender checkout with cash, M-Pesa, and customer credit.
- Customer lookup and quick-add from checkout.
- Loyalty earn and redemption support.
- Promotion code validation in checkout and admin promotion management.
- Checkout and M-Pesa idempotency keys to reduce duplicate charges on retries.
- Offline order queue replaying to `POST /api/orders/checkout`.

### Inventory And Purchasing
- Product catalog, category management, and soft product deactivation.
- Supplier directory and purchase-order receiving workflow.
- Stock adjustment audit trail with purchase, return, wastage, and correction types.
- Cost price snapshots on order items for gross profit reporting.
- Reorder suggestions from sales velocity at `GET /api/reports/reorder-suggestions`.
- CSV product import and export.
- Printable barcode label sheets.

### Operations
- Shift open/close with cash reconciliation and petty cash expenses.
- Multi-till shift summary for managers.
- Receipt lookup and browser-print receipt flow.
- Full voids, full refunds, and line-item partial refunds with stock restoration.
- Audit log review in the Operations screen.

### Reporting And Compliance
- Daily dashboard and advanced analytics reports with sales trends, payment mix, category mix, conversion, staff performance, stock health, and restock recommendations.
- CSV sales export.
- eTIMS invoice queue, retry worker, scheduler hook, and transmitted-invoice reversal lock.
- SMS receipt service wrapper for Africa's Talking credentials.
- Transactional SQL migration runner for production.

### SaaS Foundation
- Public store signup at `POST /api/signup`.
- Tenant-aware auth tokens and request context.
- Platform owner dashboard at `/super-admin` with MRR, signup activation, store activity, tenant health, and plan packaging.
- Shared Starter, Growth, and Enterprise tier catalog for plan pricing and feature packaging.
- Tenant-aware model fields and scoped admin/customer/operations queries where tenant context is present.
- Tenant-scoped uniqueness for product SKU/barcode, customer phone, and promotion codes.
- Plan feature enforcement for analytics, purchasing, promotions, loyalty, and customer credit.
- Optional per-tenant runtime settings for business receipt metadata, M-Pesa, eTIMS, and SMS credentials with environment-variable fallback.
- CI workflow for build, smoke test, and dependency-audit visibility.

## Credential-Blocked Work

These items cannot be completed entirely in code without live accounts, secrets, or business details.

- Render production account, PostgreSQL instance, domain, and secret configuration.
- Safaricom Daraja production credentials and public callback URL.
- KRA eTIMS live registration, device serial, base URL, and API key.
- Africa's Talking live SMS username, API key, and sender ID.
- Subscription billing provider credentials and webhook setup if the SaaS offering moves beyond manual plan management.

## Launch Credential Approach

- Client signup should stay lightweight and create the tenant/store account first.
- Payment and KRA credentials should be configured after signup by a platform/admin operator during the first launch phase.
- Shops can start with cash and manual M-Pesa sales before Daraja or eTIMS credentials are ready.
- STK Push should be enabled only for tenants that provide their own Daraja credentials or use an approved payment provider/aggregator.
- KRA/eTIMS sync should be enabled only after the tenant provides its own business KRA PIN, eTIMS device serial, base URL, and API key.
- Platform/super-admin credentials should not be used for client M-Pesa settlement or client KRA tax invoices.

## Known Follow-Up

- Add a real payment subscription integration for SaaS billing.
- Add tenant export/import and restore workflows for store-level operational support.
- Add a self-service Store Setup screen after signup for business profile, payment mode, Daraja credentials, and KRA/eTIMS credentials.
- Add secure secret storage/encryption before allowing tenants to enter live Daraja or eTIMS credentials directly in the app.
- Add payment-mode support per tenant: cash only, manual M-Pesa, Daraja STK Push, and payment provider/aggregator.
