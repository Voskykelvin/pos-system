# Site Map

## Screens

| Path | Screen | Purpose |
| --- | --- | --- |
| `/` | Dashboard | Daily sales, payment mix, queued eTIMS invoices, low-stock watchlist, and recent orders. |
| `/checkout` | Checkout | Cashier search, barcode lookup, cart, VAT totals, cash tender/change, and M-Pesa initiation. |
| `/inventory` | Inventory | Product catalog, category assignment, low-stock filter, and auditable stock adjustments. |

## API

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/health` | Runtime health check. |
| `GET` | `/api/bootstrap` | Current UI user/cashier identifiers. |
| `GET` | `/api/site-map` | Machine-readable site map. |
| `GET` | `/api/reports/today` | Dashboard metrics. |
| `GET` | `/api/products/search?q=milk` | Cashier product lookup by text. |
| `GET` | `/api/products/search?barcode=6160001000012` | Cashier product lookup by barcode. |
| `POST` | `/api/orders/checkout` | Create order, payments, stock movements, and queued eTIMS invoice. |
| `GET` | `/api/orders/:id/status` | Poll payment status after checkout. |
| `POST` | `/api/orders/:id/void` | Void a completed order before eTIMS transmission. |
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
