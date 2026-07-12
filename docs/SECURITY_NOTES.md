# Security Notes

Last reviewed: 2026-07-12.

## Current Controls

- Passwords are hashed in `utils/passwords.js`.
- Auth tokens are signed in `utils/authToken.js`.
- `POST /api/auth/login` is rate-limited.
- General API requests are rate-limited.
- Tenant-aware API rate limiting uses tenant ID from the auth token when available.
- `helmet` sets security headers and CSP.
- Write routes use `middleware/validate.js`.
- Checkout and M-Pesa STK push use idempotency middleware.
- Held checkout sales are stored in browser local storage per tenant/user; shared tills should use staff sign-out and clear abandoned held sales before handover.
- Offline checkout envelopes are integrity-checked in IndexedDB; reusable authentication tokens are not persisted for service-worker synchronization.
- SQL access is through Sequelize or migration scripts with parameterized replacements.
- Production schema changes use `npm run db:migrate`.
- CI runs lint, unit/component tests, API smoke tests, browser checkout tests, the frontend build, and a dependency audit.

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
- Keep `DATABASE_URL` in Render secrets only.
- Do not expose the Vite dev server in production.
- Configure CORS only if a separate domain, mobile app, or third-party API consumer is introduced.
- Review audit-log metadata before any formal data-protection review.
- Do not clear browser storage until queued and rejected offline sales have been reconciled.
- Rotate payment, SMS, eTIMS, and auth secrets on staff turnover.
