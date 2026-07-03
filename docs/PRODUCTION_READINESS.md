# Production Readiness

This POS can deploy quickly, but it should not be treated as production-safe until the launch blockers below are finished.

## Recommended ASAP Stack

- Host: Render Web Service running `npm install && npm run build` and `npm start`.
- Database: Render Postgres in the same region as the web service, connected through `DATABASE_URL`.
- Health check: `/api/health`.
- Provisioning: `render.yaml` is included for a web service plus managed Postgres.
- First schema setup: `npm run db:sync` currently uses Sequelize `sync({ alter: true })` for a fast MVP launch. Replace this with real migrations before heavy production use.

Render references:
- Node/Express deployment: https://render.com/docs/deploy-node-express-app
- Render Postgres internal/external URLs: https://render.com/docs/postgresql-creating-connecting
- Blueprints: https://render.com/docs/blueprint-spec
- Postgres backups/recovery: https://render.com/docs/postgresql-backups

## Hard Launch Blockers

1. Authentication and authorization
   - Login screen.
   - Password hashing.
   - Session/JWT handling.
   - Role-based permissions for admin, manager, cashier.
   - Manager approval for voids, refunds, discounts, stock corrections.

2. Database lifecycle
   - Replace `sync({ alter: true })` with migrations.
   - Add seed scripts for initial admin user and default categories.
   - Add backup/restore runbook.
   - Add indexes for analytics queries as data grows.

3. Payment productionization
   - Daraja production credentials.
   - Public HTTPS callback URL.
   - Idempotency for checkout and callbacks.
   - Payment reconciliation screen for pending/failed M-Pesa transactions.
   - Manual payment confirmation workflow for edge cases.

4. eTIMS productionization
   - Confirm exact KRA VSCU/OSCU payload contract.
   - Replace placeholder `etimsClient` request shape.
   - Add credit note/refund flow for invoices already transmitted.
   - Turn scheduler on only after credentials and payload are verified.

5. Receipt and audit layer
   - Printable receipt view.
   - Receipt number sequence safety under concurrent checkout.
   - Audit log for staff actions.
   - Stock cost snapshot on each order item.

6. Security and compliance
   - Store secrets only in Render environment variables.
   - Add input validation across endpoints.
   - Add rate limits on auth/payment endpoints.
   - Confirm Kenya Data Protection compliance for customer names, phones, and KRA PINs.
   - Resolve `npm audit` findings with a planned dependency upgrade pass. Current findings require breaking upgrades for Vite/node-cron and a transitive Sequelize `uuid` advisory, so they need testing rather than `npm audit fix --force`.

## Production Environment Variables

Required:
- `DATABASE_URL`
- `NODE_ENV=production`
- `BUSINESS_TIME_ZONE=Africa/Nairobi`
- `BUSINESS_NAME`
- `BUSINESS_KRA_PIN`

M-Pesa:
- `MPESA_ENV=production` once approved
- `MPESA_CONSUMER_KEY`
- `MPESA_CONSUMER_SECRET`
- `MPESA_SHORTCODE`
- `MPESA_PASSKEY`
- `MPESA_CALLBACK_URL`

eTIMS:
- `ETIMS_ENV`
- `ETIMS_BASE_URL`
- `ETIMS_API_KEY`
- `ETIMS_DEVICE_SERIAL`
- `ENABLE_ETIMS_SCHEDULER=true` only after verified

## Go-Live Sequence

1. Add auth and roles.
2. Add migrations and initial admin bootstrap.
3. Create Render Blueprint from this repo.
4. Set secrets in Render.
5. Deploy staging.
6. Run `npm run smoke` locally and test staging manually.
7. Perform a test cash sale, M-Pesa sandbox sale, void, stock adjustment, and analytics check.
8. Connect production Daraja and eTIMS credentials.
9. Enable scheduler.
10. Switch custom domain and go live.
