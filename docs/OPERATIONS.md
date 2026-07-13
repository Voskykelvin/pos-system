# Operations, Deployment, and Launch

This guide consolidates local startup, production deployment, integrations, tax setup, subscription billing, and pilot launch.

## Local development

```bash
npm ci
npm run dev
```

Open `http://localhost:5173` when using `npm run dev`. Vite serves the live frontend on port `5173` and proxies `/api` to Express on `http://localhost:4000`. For `npm start` after `npm run build`, open the combined production-style application at `http://localhost:4000`. Override the Express port with `PORT` when needed.

Without `DATABASE_URL`, the application uses an in-memory PostgreSQL-compatible database for development and tests. Data is not durable. Use PostgreSQL for staging and production.

## Verification commands

```bash
npm run lint
npm run test:unit
npm run smoke
npm run build
npm run test:e2e:run
npm run test:load
npm audit --omit=dev
```

## Render deployment

The repository blueprint is [`render.yaml`](../render.yaml).

- Build: `npm ci && npm run build`
- Pre-deploy: `npm run db:migrate`
- Start: `npm start`
- Deployment readiness check: `GET /api/ready`

Use `GET /api/live` for process liveness, `GET /api/ready` for database/migration readiness, and `GET /api/health` for diagnostics. Prometheus scrapers call `GET /api/metrics` with `Authorization: Bearer <METRICS_TOKEN>`; production returns 404 when the token is absent or invalid. Configure `ALERT_WEBHOOK_URL` for deduplicated operational alerts. Retention cleanup runs daily by default; configure `SESSION_RETENTION_DAYS`, `CALLBACK_RETENTION_DAYS`, or disable it with `ENABLE_MAINTENANCE_SCHEDULER=false`.

Required variables include `NODE_ENV=production`, `DATABASE_URL`, `AUTH_TOKEN_SECRET`, `METRICS_TOKEN`, `BUSINESS_TIME_ZONE=Africa/Nairobi`, `BUSINESS_NAME`, and `BUSINESS_KRA_PIN`. Bootstrap the platform owner with `SUPER_ADMIN_EMAIL` and `SUPER_ADMIN_PASSWORD`.

Never enable demo seeding in production. Run migrations before starting a new release and confirm the health endpoint reports PostgreSQL connectivity.

## Manual server deployment

Install with `npm ci`, build with `npm run build`, migrate with `npm run db:migrate`, and run `node server.js` behind a TLS reverse proxy and process supervisor. The server defaults to `HOST=0.0.0.0` and `PORT=4000`.

## M-Pesa

Configure `MPESA_ENV`, `MPESA_CONSUMER_KEY`, `MPESA_CONSUMER_SECRET`, `MPESA_SHORTCODE`, `MPESA_PASSKEY`, and the public `MPESA_CALLBACK_URL=https://your-domain/api/mpesa/callback`. Obtain sandbox and production credentials through Safaricom Daraja, and test callback reconciliation before enabling live tender.

In non-production environments, managers can drive pending payments through `POST /api/mpesa/simulate-callback` with `success`, `cancelled`, `timeout`, or `amount_mismatch`. The endpoint returns 404 whenever `NODE_ENV` or `MPESA_ENV` is production.

## KRA eTIMS

Configure `ETIMS_ENV`, `ETIMS_BASE_URL`, `ETIMS_API_KEY`, `ETIMS_DEVICE_SERIAL`, and `ENABLE_ETIMS_SCHEDULER`. A live rollout requires KRA registration or an authorized intermediary, a registered device serial, verified invoice payloads, and verified credit-note behavior.

Set `ETIMS_ENV=simulator` outside production to exercise the persisted queue, retry, and fiscal-response paths without external credentials.

## VAT product classification

VAT is selected per product: `standard` (currently 16%), `zero_rated` (0%), or `exempt`. Category tax is only a default. Confirm tariff-specific treatment against current KRA guidance, the current VAT Act, or a tax professional—especially processed foods and milk products. The last project review was 2026-07-06; tax rules must be rechecked before production catalog import.

## SMS receipts

Optional Africa's Talking configuration uses `AFRICASTALKING_USERNAME`, `AFRICASTALKING_API_KEY`, and `AFRICASTALKING_SENDER_ID`.

## Subscription billing

New stores register, enter `pending_payment`, and are routed to `/billing`. The MVP displays manual M-Pesa/Till/PayBill/bank instructions, accepts a payment reference, and lets the platform owner confirm or reject it. Confirmation activates the tenant and extends the billing period by 30 days.

Configure the applicable `PLATFORM_MPESA_*`, `PLATFORM_BANK_*`, and `PLATFORM_BILLING_*` variables. Automated collection should eventually reuse the same `subscription_payments` records and activation logic through signed provider webhooks.

## Pilot go-live checklist

- [ ] CI, build, smoke, browser checkout, and production audit pass.
- [ ] PostgreSQL is provisioned, backed up, migrated, and visible in `/api/health`.
- [ ] A backup has been restored into a disposable database with `BACKUP_VERIFY_DATABASE_URL`, and the result is recorded.
- [ ] Metrics scraping, alert delivery, graceful restart, and the incident snapshot command have been exercised.
- [ ] Production secrets and the platform owner account are configured.
- [ ] A tenant can sign up, submit payment, be activated, and complete store setup.
- [ ] Products have SKU/barcode, cost, price, VAT, unit, reorder level, and opening stock.
- [ ] Cashier tests cover shift open, scan/search, held sale, cash, split tender, receipt, and offline reconciliation.
- [ ] Manager tests cover expenses, refunds, partial refunds, voids, stock restoration, audit records, and shift variance.
- [ ] Dashboard, analytics, CSV exports, purchasing, and stock receipt are verified.
- [ ] Live M-Pesa/eTIMS tests run only after provider credentials and callbacks are ready.

Do not launch if tender states confuse cashiers, refunds fail to restore stock, tenant billing gates are wrong, financial reconciliation differs, or backups have not been tested.
