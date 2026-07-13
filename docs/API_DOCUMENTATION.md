# API Documentation

This document describes the request and response structures for the main API endpoints of Jijenge POS. Unless marked public, requests require `Authorization: Bearer <token>`. Tokens are application-signed bearer tokens, not JSON Web Tokens, and expire after 12 hours by default (`AUTH_TOKEN_TTL_HOURS`). Each token is bound to a hashed, server-side session that can be revoked. Monetary values are JSON numbers expressed in the tenant currency.

## Authentication & Onboarding

### 1. Staff Login
- **Endpoint:** `POST /api/auth/login`
- **Purpose:** Authenticate staff members and return a signed bearer access token.
- **Request Body:**
  ```json
  {
    "identifier": "cashier@jijenge.com",
    "password": "securepassword123"
  }
  ```
- **Response (200 OK):**
  ```json
  {
    "token": "<signed-bearer-token>",
    "user": {
      "id": "usr_90210",
      "name": "Jane Doe",
      "email": "cashier@jijenge.com",
      "role": "cashier",
      "tenantId": "ten_112233",
      "branchId": "br_445566"
    },
    "tenant": {
      "id": "ten_112233",
      "name": "Jijenge Supermarket",
      "plan": "starter",
      "status": "active"
    }
  }
  ```

### 2. Tenant Signup
- **Endpoint:** `POST /api/signup`
- **Authentication:** Public
- **Purpose:** Onboard a new store owner and auto-provision the default system configurations.
- **Request Body:**
  ```json
  {
    "businessName": "Retail Shop",
    "email": "admin@retailshop.com",
    "password": "securepassword123",
    "currency": "KES",
    "country": "KE",
    "plan": "starter"
  }
  ```
- **Response (201 Created):**
  ```json
  {
    "message": "Store provisioned successfully!",
    "token": "<signed-bearer-token>",
    "tenant": {
      "id": "ten_998877",
      "name": "Retail Shop",
      "currency": "KES",
      "plan": "starter",
      "status": "pending_payment",
      "subscriptionStartedAt": "2026-07-12T00:00:00.000Z",
      "subscriptionEndsAt": "2026-08-11T00:00:00.000Z"
    },
    "user": {
      "id": "usr_90210",
      "name": "Retail Shop Admin",
      "email": "admin@retailshop.com",
      "role": "admin",
      "tenantId": "ten_998877",
      "branchId": "br_445566"
    }
  }
  ```

### 3. End Session

- **Endpoint:** `POST /api/auth/logout`
- **Purpose:** Revoke the bearer token's current server-side session.
- **Response:** `204 No Content`

Use `POST /api/auth/logout-all` to revoke every active session belonging to the authenticated user. It returns `{ "revokedSessions": 2 }`.

---

## Subscription Billing and Mid-cycle Upgrades

- `GET /api/billing` returns the current subscription, payment history, and `billing.availableUpgrades`. Each upgrade quote includes the unused-plan credit, prorated amount due, remaining days, target features, and unchanged subscription end date.
- `POST /api/billing/payments` accepts the normal payment fields plus optional `targetPlan: "growth" | "enterprise"`. A target plan creates a pending mid-cycle upgrade rather than a renewal.
- Only active, unexpired subscriptions can upgrade mid-cycle. Moves must be to a higher-priced plan, and only one subscription payment may await review at a time.
- `POST /api/billing/payments/:id/confirm` activates the target plan immediately while preserving the original renewal date. Rejection leaves the existing plan and access unchanged.

Proration uses the unused fraction of the plan's 30-day billing interval: `(target price - current price) × remaining time ÷ 30 days`.

---

## Catalog & Products

### 4. Product Search
- **Endpoint:** `GET /api/products/search`
- **Query Parameters:**
  - `q`: Search query string (minimum 2 chars)
  - `barcode`: Exact match barcode (optional)
- **Response (200 OK):**
  ```json
  [
    {
      "id": "prod_1",
      "sku": "MILK-001",
      "barcode": "6001234567890",
      "name": "Fresh Milk 1L",
      "sellingPrice": 70.00,
      "taxCategory": "standard",
      "Category": {
        "id": "cat_2",
        "name": "Beverages"
      }
    }
  ]
  ```

### 5. Admin Products Listing (Paginated)
- **Endpoint:** `GET /api/admin/products`
- **Query Parameters:**
  - `includeInactive`: Include soft-deleted products (`true`/`false`)
  - `page`: Page index (`default: 1`)
  - `limit`: Page item count (`default: 50`)
- **Response (200 OK):**
  ```json
  {
    "items": [
      {
        "id": "prod_1",
        "name": "Fresh Milk 1L",
        "sku": "MILK-001",
        "sellingPrice": 70.00,
        "stockQuantity": 15
      }
    ],
    "total": 1,
    "page": 1,
    "limit": 50,
    "pages": 1
  }
  ```

---

## Checkout & Sales

Managers and administrators can inspect tenant-scoped callback exceptions with `GET /api/mpesa/callback-events`. Exact callback retries are fingerprinted and counted. Missing or mismatched callback amounts remain pending and appear in Operations instead of confirming the payment.

Resolve an exception with `POST /api/mpesa/callback-events/:id/resolve`. Send `action: "confirm"`, an audit `note`, and the externally verified `receiptNumber` to confirm from an M-Pesa statement. Send `action: "dismiss"` with a note to close the exception without changing payment state.

Checkout accepts `store_credit` as a customer-bound payment method. Refund endpoints accept `refundMethod: "store_credit"`; the resulting customer asset is separate from customer debt and can fund a replacement sale for an exchange.

## Runtime Operations

- `GET /api/live` is a lightweight process liveness check and does not query PostgreSQL.
- `GET /api/ready` returns `200` only when PostgreSQL is reachable and all SQL migration files are recorded in `schema_migrations`; otherwise it returns `503`.
- `GET /api/health` reports database latency, database type, uptime, and aggregate process memory for diagnostics.
- `GET /api/metrics` returns Prometheus text with bounded HTTP route/status/duration series, process gauges, queued/failed eTIMS counts, unresolved M-Pesa callback counts, and active authentication sessions. Production requires `Authorization: Bearer <METRICS_TOKEN>` or `X-Metrics-Token`; unauthorized calls intentionally return `404`.

## Advanced Inventory

- `GET/POST /api/stock-counts` and its item/completion actions manage audited cycle counts. `POST /api/stock-counts` accepts an optional `branchId`; each selected lot-tracked product expands into one count line per available lot. Send `inventoryLotId` with each lot line when recording counted quantities. Completion updates the lot, branch balance, tenant product balance, and adjustment ledger atomically.
- `GET/POST /api/stock-transfers` moves branch balances without changing tenant aggregate stock. For a lot-tracked product, each request line must include the source `inventoryLotId`. The destination receives the same lot number, expiry, and cost identity, and transfer history retains both source and destination lot IDs.
- `GET/POST /api/inventory-lots` manages lot receipts, expiry visibility, and write-offs. List queries support `productId`, `branchId`, `availableOnly=true`, and `expiringBefore` filters.
- `POST /api/purchase-orders/:id/returns` removes unsold supplier stock; `POST /api/purchase-orders/returns/:id/confirm-credit` records the later supplier credit reference.
- `POST /api/admin/products/scan-lookup` accepts a barcode, rejects tenant duplicates, optionally enriches it from Open Food Facts, selects the closest existing category, and returns a unique SKU draft. The user confirms commercial fields before creation.
- Hardware scanners may append Enter. In the scan-first panel Enter runs lookup; inside the product drawer it advances focus to the product name and never submits an incomplete product.
- The inventory scan panel can also open the device camera. Camera decoding is performed locally in the browser through a lazy-loaded ZXing decoder; the resulting code then follows the same duplicate-check and product-draft endpoint. Camera access requires HTTPS or localhost and stops when the dialog closes.

### 6. Create Checkout Order
- **Endpoint:** `POST /api/orders/checkout`
- **Required Header:** `Idempotency-Key: <unique-sale-key>` to make network retries safe
- **Idempotency Rules:** Maximum 200 characters. Reusing a key with a different route/body returns `409`; replayed responses include `Idempotency-Replayed: true`.
- **Request Body:**
  ```json
  {
    "items": [
      {
        "productId": "prod_1",
        "quantity": 2
      }
    ],
    "payments": [
      {
        "method": "cash",
        "amount": 140.00
      }
    ]
  }
  ```

Checkout consolidates duplicate product lines, accepts quantities to three decimal places, and performs stock, promotion usage, customer credit, loyalty, payments, and inventory changes in one transaction.

For a queued offline cash sale, the body also includes `offlineContext` with `schemaVersion`, `deviceId`, positive integer `sequence`, `capturedAt`, and immutable item snapshots containing `productId`, `quantity`, `unitPrice`, and `taxCategory`. The browser encrypts this body at rest and decrypts it only for authenticated foreground synchronization. The server returns `409` with `offlineConflict: true` when catalog state changed. Replaying an accepted `(tenant, deviceId, sequence)` returns the existing order with `offlineReplayed: true`.

### 7. Partial Refund

- **Endpoint:** `POST /api/orders/:id/refund/partial`
- **Purpose:** Restore selected quantities while preventing cumulative returns above the quantity sold.
- **Request Body:**
  ```json
  {
    "items": [
      { "orderItemId": "line_1", "quantity": 1 }
    ],
    "reason": "Customer return"
  }
  ```
- **Response (200 OK):** Includes `refundId`, proportional `refundSubtotal`, `refundTaxTotal`, `refundDiscountTotal`, `refundTotal`, `tenderAllocations`, and each line's new `refundableQuantity`.
- **Conflicts (409):** Transmitted eTIMS invoices and credit-tender partial refunds require dedicated fiscal or debt-adjustment workflows.

### 8. Receipt Detail

- **Endpoint:** `GET /api/orders/:id/receipt`
- **Refund Accounting:** Returns original totals plus `refundedSubtotal`, `refundedTaxTotal`, `refundedDiscountTotal`, `refundedTotal`, and `netTotal`.
- **Refund History:** `refunds` contains immutable refund records, tender allocations, reasons, timestamps, and returned line quantities.
- **Response (201 Created):**
  ```json
  {
    "id": "ord_554433",
    "orderNumber": "SUP-20260706-0001",
    "total": 140.00,
    "status": "completed",
    "paymentStatus": "paid"
  }
  ```
