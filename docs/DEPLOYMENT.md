# Deployment Guide

This document describes how to deploy, configure, and maintain the Jijenge POS system in staging and production environments.

## Deployment Targets

### 1. Platform-as-a-Service (Render, Railway, etc.)
The project is configured for seamless deployment on Render using the included [render.yaml](../render.yaml).

- **Build Command:** `npm ci && npm run build`
- **Pre-deploy Migration:** `npm run db:migrate`
- **Start Command:** `npm start`
- **Health Check Endpoint:** `GET /api/health`

### 2. Manual VPS / Virtual Machine Deployment
When deploying to a VM (Ubuntu, Debian, etc.), you can run the service behind a reverse proxy like Nginx:

1. **Clone and Install:**
   ```bash
   git clone <repo-url> /var/www/jijenge-pos
   cd /var/www/jijenge-pos
   npm ci
   ```
2. **Build Client Bundle:**
   ```bash
   npm run build
   ```
3. **Run Migrations:**
   ```bash
   npm run db:migrate
   ```
4. **Daemonize with PM2:**
   ```bash
   pm2 start server.js --name "jijenge-pos"
   ```

## Port and Host Configurations

The application reads server port and hostname from the environment:
- **`PORT`:** The port the Express server listens on (default: `4000`).
- **`HOST`:** The host interface to bind to (default: `0.0.0.0` to allow external connections).

## Database Configuration

The application uses Sequelize ORM to communicate with the database.

- **`DATABASE_URL`:** Fully qualified PostgreSQL connection URI (e.g., `postgresql://user:password@host:port/database?sslmode=require`).
- **In-Memory Fallback:** If `DATABASE_URL` is omitted, the application falls back to an in-memory SQLite database (`pg-mem`) for developer convenience and demo/smoke testing. **Do not omit `DATABASE_URL` in production.**

### Database Synchronisation & Migrations
- **`DB_SYNC`:** Set to `true` if you want the application to automatically run pending SQL migrations on startup (using inline migrations).
- **`SEED_DEMO_DATA`:** Set to `true` to populate the database with default demo data on sync (useful for staging).

## Required Production Environment Variables

Ensure the following variables are configured in your production hosting panel:

| Variable | Description | Recommended Value |
|---|---|---|
| `NODE_ENV` | Mode of execution | `production` |
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://...` |
| `AUTH_TOKEN_SECRET` | Secret key for signing JWT login tokens | Random 64-char hex string |
| `SUPER_ADMIN_EMAIL` | Email of first system owner (auto-bootstrapped) | Owner email address |
| `SUPER_ADMIN_PASSWORD` | Password of first system owner | Secure password |

For M-Pesa, eTIMS, SMS receipts, and subscription billing configuration details, refer to [PRODUCTION_READINESS.md](PRODUCTION_READINESS.md).
