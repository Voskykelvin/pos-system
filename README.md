# POS System

Express, Sequelize, and React POS for checkout, inventory control, M-Pesa initiation, eTIMS queueing, and daily operator reporting.

## Run Locally

```bash
npm install
npm run build
npm start
```

Open `http://localhost:4000`.

If `DATABASE_URL` is not set, the app starts with an in-memory demo database and seeded products/users. Set `DATABASE_URL` for PostgreSQL. Use `DB_SYNC=true` only when you want Sequelize to sync tables for that configured database.

Demo login:

```text
admin@example.local / admin12345
cashier@example.local / cashier12345
```

## Development

```bash
npm run dev
```

The API runs on `http://localhost:4000`; Vite runs on `http://localhost:5173` and proxies `/api`.

## Verification

```bash
npm run smoke
```

The smoke test boots the app against the demo database, searches products, completes a cash checkout, and checks the daily report.

## First Admin

For a real PostgreSQL database, create or reset the first admin with:

```bash
ADMIN_EMAIL=owner@example.com ADMIN_PASSWORD=change-me-now npm run admin:create
```

## Site Map

See [docs/SITE_MAP.md](docs/SITE_MAP.md).

## Production

See [docs/PRODUCTION_READINESS.md](docs/PRODUCTION_READINESS.md), [docs/POS_BUILD_ROADMAP.md](docs/POS_BUILD_ROADMAP.md), and [docs/LAUNCH_BATCHES.md](docs/LAUNCH_BATCHES.md).
