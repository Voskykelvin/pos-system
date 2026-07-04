# Production Readiness

Use this guide when deploying the POS system to Render with PostgreSQL.

## Stack

- Host: Render Web Service.
- Build command: `npm ci && npm run build`.
- Pre-deploy command: `npm run db:migrate`.
- Start command: `npm start`.
- Health check: `GET /api/health`.
- Database: Render PostgreSQL connected by `DATABASE_URL`.
- Blueprint: [`render.yaml`](../render.yaml).

## Environment Variables

Required:

- `NODE_ENV=production`
- `DATABASE_URL`
- `AUTH_TOKEN_SECRET` or `JWT_SECRET`
- `BUSINESS_TIME_ZONE=Africa/Nairobi`
- `BUSINESS_NAME`
- `BUSINESS_KRA_PIN`

M-Pesa:

- `MPESA_ENV=production`
- `MPESA_CONSUMER_KEY`
- `MPESA_CONSUMER_SECRET`
- `MPESA_SHORTCODE`
- `MPESA_PASSKEY`
- `MPESA_CALLBACK_URL=https://your-domain/api/mpesa/callback`

eTIMS:

- `ETIMS_ENV=production`
- `ETIMS_BASE_URL`
- `ETIMS_API_KEY`
- `ETIMS_DEVICE_SERIAL`
- `ENABLE_ETIMS_SCHEDULER=true`

Optional SMS receipts:

- `AFRICASTALKING_USERNAME`
- `AFRICASTALKING_API_KEY`
- `AFRICASTALKING_SENDER_ID`

## Go-Live Checklist

- [ ] Provision Render PostgreSQL.
- [ ] Create Render Web Service with `render.yaml`.
- [ ] Configure all production secrets.
- [ ] Run `npm run db:migrate`.
- [ ] Create the first admin with `npm run admin:create`.
- [ ] Confirm `/api/health` returns `{"ok":true,"database":"postgres"}`.
- [ ] Log in as admin.
- [ ] Import the product catalog or create products manually.
- [ ] Open a shift.
- [ ] Run a cash test sale.
- [ ] Run an M-Pesa test sale after live credentials are configured.
- [ ] Print a receipt from the browser print dialog.
- [ ] Close the shift and verify expected cash, counted cash, and variance.

## Built Readiness Items

| Area | Status | Implementation |
| --- | --- | --- |
| Auth and RBAC | Complete | Token auth, password hashing, role middleware. |
| Manager approvals | Complete | Approval service for voids, refunds, discounts, and stock adjustments. |
| Migrations | Complete | Transactional SQL migration runner. |
| Validation | Complete | `middleware/validate.js` on write paths. |
| Idempotency | Complete | Checkout and M-Pesa STK push keys. |
| Security headers | Complete | `helmet` CSP. |
| Rate limits | Complete | Auth, general API, and tenant-aware limits. |
| Inventory | Complete | Products, suppliers, POs, CSV, reorder suggestions. |
| Operations | Complete | Shifts, expenses, receipt lookup, voids, refunds, audit logs. |
| Reporting | Complete | Dashboard, analytics, reorder suggestions, CSV export. |

## Production Blockers Outside The Repo

- Live Safaricom Daraja credentials and callback approval.
- Live KRA eTIMS credentials and device registration.
- Business legal details for production receipts and tax payloads.
- SMS provider credentials if receipt SMS is required.
