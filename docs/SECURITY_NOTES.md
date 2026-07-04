# Security Notes

Last reviewed: 2026-07-04.

## Current Controls

- Passwords are hashed in `utils/passwords.js`.
- Auth tokens are signed in `utils/authToken.js`.
- `POST /api/auth/login` is rate-limited.
- General API requests are rate-limited.
- Tenant-aware API rate limiting uses tenant ID from the auth token when available.
- `helmet` sets security headers and CSP.
- Write routes use `middleware/validate.js`.
- Checkout and M-Pesa STK push use idempotency middleware.
- SQL access is through Sequelize or migration scripts with parameterized replacements.
- Production schema changes use `npm run db:migrate`.

## Audit Notes

Run these before a production release:

```bash
npm audit
npm run build
npm run smoke
```

Known dependency follow-up:

- Review the latest Vite/esbuild advisory status before exposing any dev server outside localhost.
- `node-cron` is on v4.5.0.
- `npm audit --omit=dev` still reports the Sequelize-transitive `uuid < 11.1.1` advisory. npm's forced fix downgrades Sequelize and should not be applied without a planned ORM migration.
- Add `npm audit` to CI once CI exists.

## Production Hardening Checklist

- Set `AUTH_TOKEN_SECRET` or `JWT_SECRET` in Render.
- Keep `DATABASE_URL` in Render secrets only.
- Do not expose the Vite dev server in production.
- Configure CORS only if a separate domain, mobile app, or third-party API consumer is introduced.
- Review audit-log metadata before any formal data-protection review.
- Rotate payment, SMS, eTIMS, and auth secrets on staff turnover.
