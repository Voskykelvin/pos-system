# POS Build Roadmap

Research points from Square, Shopify, Safaricom, KRA, and Render suggest that a credible modern POS needs fast checkout, real-time inventory, reporting, staff controls, secure payments, integrations, and compliance readiness.

## Current Strengths

- Product catalog and barcode/name search.
- Checkout with VAT calculation.
- Cash and M-Pesa payment model.
- M-Pesa STK push/callback scaffolding.
- Stock deduction and inventory transaction ledger.
- eTIMS queue/retry scaffolding.
- Product admin and stock adjustments.
- Daily dashboard and analytics page.
- Demo database for local testing.
- Role-based access control and signed JWT auth.
- Shift management and cash reconciliation.
- Voids, refunds, and audit logs.
- Request validation on all write endpoints (Batch 4).
- Idempotency protection on checkout/payments (Batch 4).
- SQL migration system replacing unsafe `sync({ alter: true })` (Batch 4).
- Analytics query indexes on all hot query paths (Batch 4).

## Build Next

See [LAUNCH_BATCHES.md](LAUNCH_BATCHES.md) for the current production batch plan.

### Batch 3: Inventory Depth (Active)

- Purchase orders and supplier receiving.
- Stock transfer if multiple branches are added.
- Product variants and pack sizes.
- Cost snapshot on order items for accurate margin reporting.
- Reorder suggestions based on sales velocity.
- CSV import/export.

### Batch 5: Core Missing Features (Researched)

The following gaps were identified by reviewing Square, Shopify POS, Lightspeed, and Loyverse (popular Kenyan retail POS). See [LAUNCH_BATCHES.md](LAUNCH_BATCHES.md) for full details.

#### High Priority
- Customer phone lookup at checkout (`Customer` model exists, no API route yet).
- Split-tender UI (cash + M-Pesa on one order — data layer already supports it).
- Rate limiting on `POST /api/auth/login` (`express-rate-limit`).

#### Medium Priority
- Partial refund by line item.
- SMS / WhatsApp receipts (Africa's Talking or Twilio).
- Product image upload.
- Discount codes and time-bound promotions.
- CSV / Excel export for daily / weekly reports.
- Customer loyalty points.

#### Low Priority
- Barcode label PDF generation.
- Offline mode with service worker + IndexedDB sync.
- Multi-till shift summary for managers.
- `helmet` security headers (CSP, HSTS, X-Frame-Options).

### Payments and Reconciliation

- M-Pesa reconciliation dashboard.
- Card payment provider integration.
- Idempotency keys on payment-changing endpoints (done — Batch 4).

### Compliance and Integrations

- KRA eTIMS VSCU/OSCU production integration.
- Credit notes for transmitted invoices.
- Accounting export (QuickBooks / Sage / Zoho CSV).
- ODPC/Data Protection review for customer data.

## Research Links

- Square reporting includes sales summary, payment methods, item/category sales, discounts, voids, tax, and transaction status: https://squareup.com/help/us/en/article/5072-summaries-and-reports-from-the-online-dashboard
- Square inventory emphasizes real-time sales/stock tracking, low-stock alerts, stock-level reporting, exports, and integrations: https://squareup.com/us/en/point-of-sale/features/inventory-management
- Shopify POS feature categories include omnichannel selling, inventory, staff, checkout, products, customers, reporting, hardware, payments, and marketing: https://www.shopify.com/pos/features
- Shopify omnichannel POS highlights shared inventory, customer profiles, order history, returns/exchanges, gift cards/discounts, staff permissions, reporting, and integrations: https://www.shopify.com/enterprise/blog/omnichannel-pos
- Loyverse POS (popular in East Africa) emphasizes loyalty programs, item variants, multiple store management, and offline mode: https://loyverse.com/pos-features
- Lightspeed Retail highlights purchase orders, supplier management, inventory counts, and multi-location: https://www.lightspeedhq.com/pos/retail/
- Safaricom Daraja is the official M-Pesa API platform: https://developer.safaricom.co.ke/
- KRA eTIMS system-to-system integration supports VSCU and OSCU paths: https://www.kra.go.ke/business/etims-electronic-tax-invoice-management-system/learn-about-etims/etims-system-to-system-integration
- Africa's Talking SMS API for SMS receipts: https://africastalking.com/sms
