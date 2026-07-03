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

Status: next.

- Supplier receiving.
- Purchase orders.
- CSV import/export.
- Cost snapshot on order items.
- Reorder suggestions based on sales velocity.
- Product variants/pack sizes.

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

- **Customer Phone Lookup & Create at Checkout**: Cashiers can search customers by phone/name or register a new customer right inside Checkout.
- **Split-Tender Payments**: Supports paying via multiple methods (Cash + M-Pesa) on the same sale with a multi-row UI and automatic balance calculation.
- **Auth Rate Limiting & Security Headers**: Installed `express-rate-limit` (10 login attempts per 15 min; 120 API requests/min) and `helmet` for CSP/security headers.
- **Partial Refund by Line Item**: Managers can select specific items and quantities from a past order to return and restore stock individually.
- **CSV Data Export**: `GET /api/reports/export?days=7` streams Excel-compatible CSVs directly from Analytics.
- **Multi-Till Shift Summary**: `GET /api/shifts/summary` aggregates all cashiers' shift floats, sales, and variances for managers.
- **Loyalty Points Engine**: Auto-awards 1 point per KES 100 spent (configurable) and tracks customer point ledgers (`LoyaltyTransaction`).
- **Promotions & Discount Codes**: `Promotion` model supporting percent/fixed discounts, expiration dates, min order totals, max use caps, and `GET /api/promotions/validate`.
- **SMS Receipt Scaffold**: Service wrapper for Africa's Talking SMS receipts (`services/smsService.js`), safely no-opting when credentials aren't set.

---

## Credential-Blocked Work

These require accounts, approval, secrets, or business/legal details before they can be completed.

### Render Production Deployment
Needs: Render account access, DB URL, domain name.

### M-Pesa Daraja Production
Needs: Safaricom developer credentials, passkey, live callback URL.

### KRA eTIMS
Needs: Official VSCU/OSCU registration, device serials, live KRA endpoint access.
