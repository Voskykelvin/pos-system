# Pilot Launch Checklist

Use this checklist for the first controlled shop rollout before broad SaaS onboarding.

## 1. Production Setup

- Provision PostgreSQL and set `DATABASE_URL`.
- Configure `AUTH_TOKEN_SECRET`, `BUSINESS_TIME_ZONE=Africa/Nairobi`, `BUSINESS_NAME`, and `BUSINESS_KRA_PIN`.
- Configure at least one platform subscription payment channel:
  - `PLATFORM_MPESA_PHONE` for the first manual M-Pesa collection path, or
  - `PLATFORM_MPESA_TILL` / `PLATFORM_MPESA_PAYBILL` after merchant setup.
- Run `npm run db:migrate`.
- Run `npm run build`.
- Run `npm run smoke`.
- Confirm `GET /api/health` reports `database: "postgres"`.

## 2. Platform Owner Setup

- Set `SUPER_ADMIN_EMAIL` and `SUPER_ADMIN_PASSWORD`.
- Log in as the super-admin.
- Confirm `/super-admin` loads MRR, tenant health, pending payment review, and subscription alerts.
- Confirm the current Starter, Growth, and Enterprise plan prices.

## 3. Store Onboarding

- Create the tenant through `/signup`.
- Confirm the store lands on `/billing` as `pending_payment`.
- Submit the subscription payment reference.
- Confirm the payment in `/super-admin`.
- Confirm the store owner can open the workspace after activation.
- Complete Store Setup:
  - business receipt name,
  - KRA PIN,
  - branch profile,
  - cashier/manager staff accounts,
  - M-Pesa collection mode,
  - eTIMS status.

## 4. Product And Inventory Setup

- Import products by CSV or create the pilot catalog manually.
- Confirm SKU/barcode uniqueness for the tenant.
- Set cost price, selling price, VAT category, unit, reorder level, and opening stock.
- Print and scan barcode labels for a sample product group.
- Confirm low-stock and reorder suggestions work after sample sales.

## 5. Cashier Workflow Test

- Log in as cashier.
- Open a shift with opening float.
- Search products by text.
- Scan product barcodes.
- Change quantities.
- Hold a sale with a note, start another cart, then recall the held sale.
- Run one cash sale.
- Run one split tender sale.
- Run one M-Pesa sale after live credentials are configured.
- Print a receipt.
- Confirm failed M-Pesa guidance is understandable to the cashier.

## 6. Operations Test

- Log a petty cash expense.
- Search for a receipt.
- Void a completed sale as manager/admin.
- Refund a completed sale as manager/admin.
- Perform a line-item partial refund.
- Confirm stock restoration after refunds/voids.
- Confirm audit logs show checkout, shift, refund, void, and manager approval events.
- Confirm Operations warns if held sales still exist before closing shift.
- Close shift and verify expected cash, counted cash, expenses, and variance.

## 7. Reporting Test

- Open Dashboard and confirm sales, payment mix, low stock, and recent orders.
- Open Analytics and confirm trend charts load for the pilot tenant.
- Export sales CSV.
- Export product CSV.
- Confirm purchase order receiving updates stock.

## 8. Go/No-Go

Go only when:

- `npm run build` passes.
- `npm run smoke` passes.
- Cashier can complete core sales without admin help.
- Super-admin can activate, suspend, and review subscriptions.
- Shift close variance matches expected cash after test transactions.
- Receipt printout is acceptable for the shop.
- The owner knows the manual subscription payment process.

No-go if:

- M-Pesa pending/failed states confuse cashiers.
- Held sales can be forgotten at shift close without warning.
- Refunds/voids do not restore stock correctly.
- Tenant subscription state blocks paid stores or allows unpaid operational access.
