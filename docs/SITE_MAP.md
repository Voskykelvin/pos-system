# Site Map

## Screens

| Path | Screen | Purpose |
| --- | --- | --- |
| `/` | Dashboard | Daily sales, payment mix, queued eTIMS invoices, low-stock watchlist, and recent orders. |
| `/checkout` | Checkout | Cashier search, barcode lookup, cart, VAT totals, cash tender/change, and M-Pesa initiation. |
| `/inventory` | Inventory | Product catalog, category assignment, low-stock filter, and auditable stock adjustments. |
| `/analytics` | Analytics | Sales summaries, stock health, best sellers, category mix, and slow movers. |
| `/operations` | Operations | Shift control, cash reconciliation, receipt lookup, receipt printing, voids, refunds, and audit review. |

## API

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/health` | Runtime health check. |
| `POST` | `/api/auth/login` | Staff login and auth token issue. |
| `GET` | `/api/auth/me` | Current authenticated staff user. |
| `GET` | `/api/bootstrap` | Current UI user/cashier identifiers. |
| `GET` | `/api/site-map` | Machine-readable site map. |
| `GET` | `/api/reports/today` | Dashboard metrics. |
| `GET` | `/api/reports/analytics?days=30` | Sales, inventory, and stock health analytics. |
| `GET` | `/api/products/search?q=milk` | Cashier product lookup by text. |
| `GET` | `/api/products/search?barcode=6160001000012` | Cashier product lookup by barcode. |
| `POST` | `/api/orders/checkout` | Create order, payments, stock movements, and queued eTIMS invoice. |
| `GET` | `/api/orders/search?q=receipt` | Search recent receipts/orders by receipt number. |
| `GET` | `/api/orders/:id/receipt` | Detailed receipt payload for lookup and printing. |
| `GET` | `/api/orders/:id/status` | Poll payment status after checkout. |
| `POST` | `/api/orders/:id/void` | Void a completed order before eTIMS transmission. |
| `POST` | `/api/orders/:id/refund` | Refund a completed order before eTIMS transmission. |
| `GET` | `/api/shifts/current` | Current open shift for the authenticated cashier. |
| `GET` | `/api/shifts` | Manager/admin list of recent shifts. |
| `POST` | `/api/shifts/open` | Open a cashier shift with starting float. |
| `POST` | `/api/shifts/:id/close` | Close a shift and record counted cash variance. |
| `GET` | `/api/audit-logs` | Manager/admin review of recent sensitive actions and approvals. |
| `POST` | `/api/mpesa/stk-push` | Start M-Pesa STK push for a pending payment. |
| `POST` | `/api/mpesa/callback` | Receive Safaricom Daraja callback. |
| `POST` | `/api/etims/sync` | Manually process queued eTIMS invoices. |
| `POST` | `/api/etims/requeue-failed` | Retry failed eTIMS invoices. |
| `GET` | `/api/admin/products` | List products. |
| `GET` | `/api/admin/products/low-stock` | List products at or below reorder level. |
| `POST` | `/api/admin/products` | Create product with opening stock ledger. |
| `PUT` | `/api/admin/products/:id` | Update product metadata. |
| `DELETE` | `/api/admin/products/:id` | Soft-deactivate product. |
| `POST` | `/api/admin/products/:id/adjust-stock` | Post auditable stock movement. |
| `GET` | `/api/admin/categories` | List product categories. |
| `POST` | `/api/admin/categories` | Create product category. |
