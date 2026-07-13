# Security Notes

Last reviewed: 2026-07-13.

## Current Controls

- Passwords are hashed in `utils/passwords.js`.
- Auth tokens are signed in `utils/authToken.js` and bound to hashed, persistent records in `auth_sessions`.
- Logout revokes the current session server-side; `/api/auth/logout-all` revokes all sessions for the user.
- Store Security lists active browser sessions and supports remote per-device revocation.
- Access tokens are short-lived, kept in memory by the browser application, and are not persisted in local storage. An HTTP-only SameSite refresh cookie restores and rotates the session after reload.
- Administrators and platform owners can enable TOTP authenticator MFA; secrets are AES-256-GCM encrypted using `MFA_ENCRYPTION_KEY`.
- `POST /api/auth/login` is rate-limited.
- General API requests are rate-limited.
- Tenant-aware API rate limiting uses tenant ID from the auth token when available.
- `helmet` sets security headers and CSP.
- Write routes use `middleware/validate.js`.
- Checkout and M-Pesa STK push use idempotency middleware.
- M-Pesa callbacks are durably fingerprinted; duplicate deliveries are counted and amount mismatches are quarantined for manager review.
- Held checkout sales and offline checkout payloads are AES-256-GCM encrypted in IndexedDB with a non-extractable device key. Existing readable held/queued records migrate lazily.
- Offline checkout envelopes are integrity-checked after decryption; reusable authentication tokens are not persisted for service-worker synchronization.
- SQL access is through Sequelize or migration scripts with parameterized replacements.
- Production schema changes use `npm run db:migrate`.
- CI runs lint, unit/component tests, API smoke tests, browser checkout tests, the frontend build, and a dependency audit.
- Product barcode enrichment performs read-only requests and can be disabled with `PRODUCT_CATALOG_LOOKUP_ENABLED=false`. Catalogue responses remain untrusted drafts and never set prices or create products automatically.
- Camera barcode scanning requests permission only after the user opens the scanner, decodes frames locally, and stops every media track when closed. Browsers require HTTPS outside localhost.
- Lot counts and transfers validate the selected branch, product, and lot against the authenticated tenant before taking row locks or changing balances.
- Production metrics are hidden behind `METRICS_TOKEN`, compared in constant time, and expose only bounded route labels plus aggregate operational counts.
- Alert webhooks sanitize and truncate context, deduplicate repeated failures, and never intentionally include credentials or request bodies.
- Database backups include SHA-256 metadata; CI restores an archive into a disposable PostgreSQL database and verifies critical tables.

## Audit Notes

Run these before a production release:

```bash
npm audit
npm run build
npm run smoke
```

The current full and production-only dependency audits report zero known vulnerabilities. Continue reviewing Vite/esbuild advisories before exposing any development server outside localhost.

## Production Hardening Checklist

- Set `AUTH_TOKEN_SECRET` or `JWT_SECRET` in Render.
- Review and remove expired/revoked `auth_sessions` through a scheduled retention job before session volume becomes material.
- Keep `DATABASE_URL` in Render secrets only.
- Do not expose the Vite dev server in production.
- Configure CORS only if a separate domain, mobile app, or third-party API consumer is introduced.
- Review audit-log metadata before any formal data-protection review.
- Do not clear browser storage until queued and rejected offline sales have been reconciled.
- Rotate payment, SMS, eTIMS, and auth secrets on staff turnover.
- Store `METRICS_TOKEN` and `ALERT_WEBHOOK_URL` as deployment secrets. Rotate either immediately if exposed.
- Encrypt backup files at rest, restrict restore credentials, and never run a restore drill against production.
