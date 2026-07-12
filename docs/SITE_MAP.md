# Site Map

## Screens

| Path | Screen | Purpose |
| --- | --- | --- |
| `/home` | Master Homepage | Public product homepage, signup entry, pricing, and feature map back into the app. |
| `/billing` | Subscription Billing | Tenant subscription payment instructions, manual reference submission, billing status, and payment history. |
| `/` | Dashboard | Daily sales, payment mix, queued eTIMS invoices, low-stock watchlist, and recent orders. |
| `/checkout` | Checkout | Product search, barcode scanner input, phone catalog/cart switching, persistent mobile totals, held-sale recall, offline reconciliation, VAT totals, split payments, and M-Pesa initiation. |
| `/inventory` | Inventory | Products, categories, suppliers, purchase orders, reorder suggestions, promotions, CSV tools, and barcode labels. |
| `/analytics` | Analytics | Sales trends, conversion, payment mix, category mix, staff performance, stock health, restock recommendations, and export links. |
| `/customers` | Customers | Customer profiles, loyalty balances, credit ledgers, and debt repayments. |
| `/operations` | Operations | Shift control, petty cash expenses, cash reconciliation, receipt lookup, voids, refunds, printing, and audit review. |
| `/super-admin` | Platform SaaS Overview | Platform owner overview for MRR, subscription review, and tenant health. |
| `/super-admin/analytics` | Platform Analytics | Signup trends, tenant POS sales signal, plan economics, and health charts. |
| `/super-admin/plans` | Platform Plans | Starter, Growth, and Enterprise plan packaging. |
| `/super-admin/subscriptions` | Platform Subscriptions | Subscription alerts and pending payment reference review. |
| `/super-admin/tenants` | Platform Users & Stores | Tenant owner profiles, store status, plan updates, suspension, and unused profile cleanup. |

## API

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/health` | Runtime health check. |
| `GET` | `/api/bootstrap` | Current authenticated user and cashier identifiers. |
| `GET` | `/api/site-map` | Machine-readable site map. |
| `GET` | `/api/plans` | Public plan and pricing catalog for homepage and signup. |
| `POST` | `/api/signup` | Self-serve tenant signup. |
| `GET` | `/api/billing` | Tenant subscription status, payment instructions, and recent payment references. |
| `POST` | `/api/billing/payments` | Submit a manual subscription payment reference for admin verification. |
| `POST` | `/api/billing/payments/:id/confirm` | Super-admin confirms a subscription payment and extends the billing period. |
| `POST` | `/api/billing/payments/:id/reject` | Super-admin rejects an unverified subscription payment reference. |
| `GET` | `/api/super-admin/dashboard` | Platform owner MRR, activation, tenant health, plan tiers, and activity metrics. |
| `PUT` | `/api/super-admin/tenants/:id` | Platform owner tenant status or plan update. |
| `DELETE` | `/api/super-admin/tenants/:id` | Delete an unused tenant profile that has no protected business activity. |
| `POST` | `/api/auth/login` | Staff login and auth token issue. |
| `GET` | `/api/auth/me` | Current authenticated staff user. |
| `GET` | `/api/products/search` | Cashier product lookup by text or barcode. |
| `POST` | `/api/orders/checkout` | Create order, payments, stock movements, ledgers, and queued eTIMS invoice. |
| `GET` | `/api/orders/search` | Search recent receipts/orders by receipt number. |
| `GET` | `/api/orders/:id/receipt` | Detailed receipt payload. |
| `GET` | `/api/orders/:id/status` | Poll payment status after checkout. |
| `POST` | `/api/orders/:id/void` | Void a completed order before eTIMS transmission. |
| `POST` | `/api/orders/:id/refund` | Refund a completed order before eTIMS transmission. |
| `POST` | `/api/orders/:id/refund/partial` | Return selected line items and restore stock. |
| `POST` | `/api/mpesa/stk-push` | Start M-Pesa STK push for a pending payment. |
| `POST` | `/api/mpesa/callback` | Receive Safaricom Daraja callback. |
| `GET` | `/api/customers/search` | Search customers by name or phone. |
| `POST` | `/api/customers` | Create a customer. |
| `GET` | `/api/customers/:id/ledger` | Customer credit ledger. |
| `POST` | `/api/customers/:id/payment` | Record a debt repayment. |
| `GET` | `/api/shifts/current` | Current open shift for the authenticated cashier. |
| `GET` | `/api/shifts/summary` | Manager/admin multi-till shift summary. |
| `POST` | `/api/shifts/open` | Open a cashier shift. |
| `POST` | `/api/shifts/:id/close` | Close a shift and record counted cash variance. |
| `POST` | `/api/shifts/expenses` | Log petty cash expense against an open shift. |
| `GET` | `/api/reports/today` | Dashboard metrics. |
| `GET` | `/api/reports/analytics` | Sales trends, conversion, staff, inventory, and stock health analytics. |
| `GET` | `/api/reports/export` | CSV sales export. |
| `GET` | `/api/reports/reorder-suggestions` | Sales velocity reorder suggestions. |
| `GET` | `/api/admin/products` | List products for back office. |
| `POST` | `/api/admin/products` | Create product. |
| `PUT` | `/api/admin/products/:id` | Update product metadata. |
| `DELETE` | `/api/admin/products/:id` | Soft-deactivate product. |
| `POST` | `/api/admin/products/:id/adjust-stock` | Post auditable stock movement. |
| `GET` | `/api/admin/products/export-csv` | Export product catalog CSV. |
| `POST` | `/api/admin/products/import-csv` | Import product catalog CSV. |
| `GET` | `/api/admin/categories` | List product categories. |
| `POST` | `/api/admin/categories` | Create product category. |
| `GET` | `/api/admin/promotions` | List promotion codes. |
| `POST` | `/api/admin/promotions` | Create promotion code. |
| `PUT` | `/api/admin/promotions/:id` | Update promotion code. |
| `GET` | `/api/promotions/validate` | Validate a checkout promotion code. |
| `GET` | `/api/suppliers` | List suppliers. |
| `POST` | `/api/suppliers` | Create supplier. |
| `PUT` | `/api/suppliers/:id` | Update supplier. |
| `GET` | `/api/purchase-orders` | List purchase orders. |
| `POST` | `/api/purchase-orders` | Create purchase order. |
| `POST` | `/api/purchase-orders/:id/receive` | Receive stock from purchase order. |
| `GET` | `/api/audit-logs` | Manager/admin audit trail. |
| `POST` | `/api/etims/sync` | Manually process queued eTIMS invoices. |
| `POST` | `/api/etims/requeue-failed` | Retry failed eTIMS invoices. |
