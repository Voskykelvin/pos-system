# Security Notes

> Generated: 2026-07-04 | Batch 4 Audit Pass

## `npm audit` Findings

### Finding 1 — esbuild CORS bypass (Moderate)
- **Package:** `esbuild ≤ 0.24.2` (via `vite`)
- **Advisory:** [GHSA-67mh-4wv8-2f99](https://github.com/advisories/GHSA-67mh-4wv8-2f99)
- **Risk:** The esbuild dev server allows any website to make cross-origin requests to it and read responses. **Dev-only — the esbuild server is never exposed in production.**
- **Fix:** `npm audit fix --force` would upgrade to vite@8.x (breaking change). Scheduled for Batch 4 verification after confirming vite@8 build compatibility.
- **Mitigation:** The production build uses `npm run build` + Node/Express static serving. esbuild is only active during `npm run dev`. Do not expose port 5173 on a production machine.

### Finding 2 — uuid buffer bounds check missing (Moderate → affects node-cron and sequelize)
- **Package:** `uuid < 11.1.1` (via `node-cron@3.0.x` and `sequelize`)
- **Advisory:** [GHSA-w5hq-g745-h8pq](https://github.com/advisories/GHSA-w5hq-g745-h8pq)
- **Risk:** Missing buffer bounds check in uuid v3/v5/v6 when a `buf` argument is provided. **This POS system does not call uuid with a buf argument directly.** Sequelize and node-cron call uuid internally without the vulnerable argument pattern.
- **Fix:** `npm audit fix` (non-breaking) applied — upgrades uuid transitively where possible. Full fix requires `node-cron@4.x` (potentially breaking API change) — deferred.
- **Mitigation:** Verify uuid usage in node_modules does not pass `buf`. Monitor for upstream patch in `node-cron@3.x`.

---

## Action Items

| Item | Priority | Owner | Status |
|---|---|---|---|
| Test vite@8.x compatibility and upgrade | Medium | Dev | Deferred to Batch 5 prep |
| Pin `node-cron` to `^4.x` and verify cron syntax | Low | Dev | Deferred |
| Add `npm audit` to CI pipeline | High | DevOps | Pending CI setup |

---

## Production Hardening Notes (Not Vulnerabilities)

These are configuration and architecture concerns, not CVEs:

### 1. JWT Secret
- `JWT_SECRET` must be set in the Render environment before go-live.
- A missing secret falls back to `'dev-secret-CHANGE-THIS'` in `utils/authToken.js`. **This will invalidate all tokens on every deploy if not set consistently.**
- Recommendation: Generate with `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"` and store in Render secrets.

### 2. Rate Limiting
- No rate limit is applied to `POST /api/auth/login`. A brute-force attack can attempt unlimited passwords.
- **Recommendation (Batch 5):** Add `express-rate-limit` on auth endpoints: 10 attempts per 15 minutes per IP.

### 3. SQL Injection
- All DB queries use Sequelize ORM or parameterised `sequelize.query(statement, { replacements })`. No raw string interpolation into SQL. ✅

### 4. CORS
- No `cors` middleware is configured. In production behind Render, the Express server serves both the API and the built frontend from the same origin — no cross-origin requests needed. If a mobile app or third-party consumer is added later, configure `cors` with an explicit allowlist.

### 5. Content-Security-Policy
- No CSP headers are set. Add `helmet` (or manual headers) in Batch 5 when compliance hardening happens.

### 6. Passwords
- Passwords are hashed with `bcrypt` (verified in `utils/passwords.js`). ✅
- Work factor should be reviewed annually and bumped as hardware gets faster.

### 7. Sensitive Data in Audit Logs
- `metadata` JSONB in `audit_logs` could accidentally log payment amounts or partial phone numbers. Review what goes into `metadata` fields before ODPC/Data Protection review.

---

## Re-audit Command

```bash
npm audit
npm audit fix          # apply safe, non-breaking fixes
npm audit fix --force  # apply breaking fixes (test carefully)
```
