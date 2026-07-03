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

## Site Map

See [docs/SITE_MAP.md](docs/SITE_MAP.md).

## Production

See [docs/PRODUCTION_READINESS.md](docs/PRODUCTION_READINESS.md) and [docs/POS_BUILD_ROADMAP.md](docs/POS_BUILD_ROADMAP.md).
