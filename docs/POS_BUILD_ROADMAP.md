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

## Build Next

See [LAUNCH_BATCHES.md](LAUNCH_BATCHES.md) for the current production batch plan.

### 1. Core Store Operations

- Staff login, roles, and PIN unlock.
- Shift open/close and cash drawer reconciliation.
- Discounts with manager approval.
- Returns/refunds and exchange flows.
- Receipt printing and receipt search.
- Customer lookup by phone.

### 2. Inventory Depth

- Purchase orders and supplier receiving.
- Stock transfer if multiple branches are added.
- Product variants and pack sizes.
- Cost snapshot on order items for accurate margin reporting.
- Reorder suggestions based on sales velocity.
- CSV import/export.

### 3. Analytics

- Best-selling products by units and revenue.
- Category performance.
- Slow movers and dead stock.
- Low-stock and out-of-stock alerts.
- Sell-through and sales velocity.
- Cashier performance.
- Void/refund/discount exception reports.

### 4. Payments and Reconciliation

- M-Pesa reconciliation dashboard.
- Partial payments and split tender.
- Card payment provider integration.
- Payment reversal/refund workflow.
- Idempotency keys on payment-changing endpoints.

### 5. Compliance and Integrations

- KRA eTIMS VSCU/OSCU production integration.
- Credit notes for transmitted invoices.
- Accounting export.
- ODPC/Data Protection review for customer data.

## Research Links

- Square reporting includes sales summary, payment methods, item/category sales, discounts, voids, tax, and transaction status: https://squareup.com/help/us/en/article/5072-summaries-and-reports-from-the-online-dashboard
- Square inventory emphasizes real-time sales/stock tracking, low-stock alerts, stock-level reporting, exports, and integrations: https://squareup.com/us/en/point-of-sale/features/inventory-management
- Shopify POS feature categories include omnichannel selling, inventory, staff, checkout, products, customers, reporting, hardware, payments, and marketing: https://www.shopify.com/pos/features
- Shopify omnichannel POS highlights shared inventory, customer profiles, order history, returns/exchanges, gift cards/discounts, staff permissions, reporting, and integrations: https://www.shopify.com/enterprise/blog/omnichannel-pos
- Safaricom Daraja is the official M-Pesa API platform: https://developer.safaricom.co.ke/
- KRA eTIMS system-to-system integration supports VSCU and OSCU paths: https://www.kra.go.ke/business/etims-electronic-tax-invoice-management-system/learn-about-etims/etims-system-to-system-integration
