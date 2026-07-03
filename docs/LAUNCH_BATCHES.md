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

Status: next.

- Manager approval for voids, discounts, refunds, and stock corrections.
- Audit log table for staff actions.
- Shift open/close and cash reconciliation.
- Printable receipt view.
- Receipt/order search.

### Batch 3: Inventory Depth

Status: queued.

- Supplier receiving.
- Purchase orders.
- CSV import/export.
- Cost snapshot on order items.
- Reorder suggestions based on sales velocity.
- Product variants/pack sizes.

### Batch 4: Data Quality And Safety

Status: queued.

- Request validation on all write endpoints.
- Idempotency keys for checkout/payment-changing endpoints.
- Proper migrations replacing `sequelize.sync({ alter: true })`.
- Analytics indexes.
- Dependency upgrade pass for `npm audit` findings.

## Credential-Blocked Work

These require accounts, approval, secrets, or business/legal details before they can be completed.

### Render Production Deployment

Needs:
- Render account access.
- Billing plan decision.
- Production domain name.
- Production environment variables.
- Render Postgres instance.

Code already provided:
- `render.yaml`
- `npm run db:sync`
- `/api/health`

### M-Pesa Daraja Production

Needs:
- Safaricom developer app.
- Production consumer key and secret.
- Business shortcode.
- Passkey.
- Public HTTPS callback URL.
- Live transaction testing approval.

Code already provided:
- STK push helper.
- Callback endpoint.
- Pending payment polling.

### KRA eTIMS

Needs:
- KRA SI/VSCU or OSCU registration details.
- Device serial or equivalent issued identifier.
- Final payload specification.
- API endpoint and auth credentials.
- Credit note/refund rules.

Code already provided:
- eTIMS invoice queue.
- Retry worker.
- Manual sync/requeue endpoints.
- Placeholder client to replace after official credentials/spec.

### Business And Compliance

Needs:
- Legal business name.
- KRA PIN.
- Receipt footer details.
- Data retention policy.
- ODPC/Data Protection review for customer phone, name, and KRA PIN storage.

## Production Push Rule

Each batch should be implemented, built, smoke-tested, committed, and pushed only once the feature set is internally complete. Credential-blocked work should stay documented until the actual credentials are available.
