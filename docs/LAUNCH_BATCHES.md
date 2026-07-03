# Launch Batches

This separates work we can build entirely in code from work that cannot be completed until external credentials, accounts, or official integration details are available.

## Code-Based Work

These can be built and tested locally or on staging without waiting for third parties.

### Batch 1: Access Control

Status: built.

- Staff login.
- Password hashing.
- Signed auth tokens.
- Role-based access control.
- Protected checkout, inventory, analytics, reports, eTIMS admin endpoints, and product search.
- Admin bootstrap script: `npm run admin:create`.

### Batch 2: Operational Controls

Status: built.

- Manager approval for voids, discounts, refunds, and stock corrections.
- Audit log table for staff actions.
- Manager/admin audit review endpoint and Operations screen panel.
- Shift open/close and cash reconciliation.
- Printable receipt view.
- Receipt/order search.
- Refunds and voids restore stock, reverse payments, cancel queued eTIMS invoices, and block direct reversal after eTIMS transmission.

### Batch 3: Inventory Depth

Status: built.

- **Suppliers Directory**: `Supplier` model and routes (`GET/POST/PUT /api/suppliers`) for vendor management.
- **Purchase Orders & Stock Intake**: `PurchaseOrder` and `PurchaseOrderItem` models and receiving workflow (`POST /api/purchase-orders/:id/receive`) that automatically increments product stock, logs purchase `InventoryTransaction` entries, and updates product cost price.
- **Cost Price Snapshots**: `costPrice` snapshot on `OrderItem` at checkout for accurate gross profit analytics over time.
- **Sales Velocity Reorder Suggestions**: `GET /api/reports/reorder-suggestions?days=30` analyzes daily sales velocity over N days to calculate exact reorder quantities.
- **Bulk CSV Import & Export**: `POST /api/admin/products/import-csv` for bulk product creation/updates and `GET /api/admin/products/export-csv` for catalog downloads.
- **Inventory Sub-Tabs**: Added 5 sub-navigation tabs to `ProductAdmin.jsx` (Products, Suppliers, Purchase Orders, Reorder Suggestions, CSV Tools).

### Batch 4: Data Quality And Safety

Status: built.

- Request validation middleware (`middleware/validate.js`) on all write endpoints.
- Idempotency keys (`middleware/idempotency.js`) on `POST /api/orders/checkout` and `POST /api/mpesa/stk-push`.
- SQL migration runner replacing `sequelize.sync({ alter: true })`:
  - `migrations/001_initial_schema.sql`
  - `scripts/migrate.js` & `scripts/migrate-inline.js`
- Analytics DB indexes added to Order, OrderItem, Payment, EtimsInvoice, and InventoryTransaction models.
- Security audit pass documented in `docs/SECURITY_NOTES.md`.

### Batch 5: Core Missing Features

Status: built.

- Customer Phone Lookup & Create at Checkout.
- Split-Tender Payments (Cash + M-Pesa).
- Auth Rate Limiting & Helmet Headers.
- Partial Refund by Line Item.
- CSV Data Export.
- Multi-Till Shift Summary.
- Loyalty Points Engine.
- Promotions & Discount Codes.
- SMS Receipt Scaffold.

---

## Credential-Blocked Work

These require accounts, approval, secrets, or business/legal details before they can be completed.

### Render Production Deployment
Needs: Render account access, DB URL, domain name.

### M-Pesa Daraja Production
Needs: Safaricom developer credentials, passkey, live callback URL.

### KRA eTIMS
Needs: Official VSCU/OSCU registration, device serials, live KRA endpoint access.
