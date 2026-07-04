# POS Build Roadmap

Research points from Square, Shopify, Safaricom, KRA, and Render suggest that a credible modern POS needs fast checkout, real-time inventory, reporting, staff controls, secure payments, integrations, and compliance readiness.

---

## ✅ Completed System Capabilities (Batches 1–5 Delivered)

### 🛡️ Access Control & Safety (Batches 1 & 4)
- Staff authentication with hashed passwords (`bcrypt`) and signed JWT tokens (`authToken.js`).
- Role-Based Access Control (`admin`, `manager`, `cashier`) enforcing permission levels across all API routes.
- Dependency-free Schema Validator (`middleware/validate.js`) running on every write endpoint.
- Idempotency Key Caching (`middleware/idempotency.js`) preventing double-charging on checkout & STK push retries.
- Production SQL Migration System (`scripts/migrate.js` & `scripts/migrate-inline.js`) replacing unsafe `alter:true` syncs.
- DB Composite Query Indexes added to `Order`, `OrderItem`, `Payment`, `EtimsInvoice`, and `InventoryTransaction`.
- Rate Limiting (`express-rate-limit`: 10 auth attempts / 15 min; 120 API calls / min) and `helmet` CSP security headers.

### 📦 Operational & Store Controls (Batches 2 & 5)
- Manager approval verification for voids, discounts, full/partial refunds, and stock adjustments.
- Audit Log System (`AuditLog` model, logger service, and Operations UI review panel).
- Shift Open/Close with Cash Reconciliation & Today's Multi-Till Shift Summary for Managers.
- Full and Line-Item Partial Refunds (`POST /api/orders/:id/refund/partial`) with automatic inventory re-crediting.
- Customer Phone Lookup & Quick-Add inside Checkout with automatic loyalty point earnings.
- Split-Tender Multi-Payment UI allowing Cash + M-Pesa payments on the same order.
- Promotions & Discount Codes Engine (`Promotion` model, Checkout validation, and Admin management tab).
- One-Click Excel-Compatible CSV Data Export (`GET /api/reports/export`).
- SMS Receipt Service Wrapper (`services/smsService.js` for Africa's Talking API).

### 🚚 Inventory Depth & Supplier Management (Batch 3)
- Suppliers Directory (`Supplier` model & admin UI).
- Purchase Orders & Receiving Workflow (`PurchaseOrder` & `PurchaseOrderItem` models) automatically updating product stock, cost prices, and logging purchase inventory transactions.
- Cost Price Snapshotting on `OrderItem` at checkout for accurate gross profit tracking over time.
- Sales Velocity Reorder Suggestion Engine (`GET /api/reports/reorder-suggestions?days=30`) with an Auto-Generate PO button.
- Bulk Product Catalog CSV Import & Export (`POST /api/admin/products/import-csv` & `GET /api/admin/products/export-csv`).
- 5 Inventory Sub-Tabs in `ProductAdmin.jsx` (Products, Suppliers, Purchase Orders, Reorder Suggestions, Promotions, CSV Tools).

---

## 🔒 What Remains (Credential-Blocked Integration Work)

These items require official business registration, live third-party accounts, or production API keys to go live in a production environment:

1. **Render Production Infrastructure**:
   - Production PostgreSQL connection string (`DATABASE_URL`).
   - Domain SSL configuration & secret key rotation.
2. **Safaricom M-Pesa Daraja Live Credentials**:
   - Production Business Shortcode, Consumer Key, Consumer Secret, and Passkey.
   - Public HTTPS Callback URL for live transaction callbacks.
3. **KRA eTIMS Live System Integration**:
   - Official KRA VSCU / OSCU registration, device serials, and live API endpoints for automated tax invoice transmission.
4. **Africa's Talking SMS API Key**:
   - API Key and Sender ID for sending live SMS receipts to customers.

---

## Research Links

- Square reporting & inventory: https://squareup.com/help/us/en/article/5072-summaries-and-reports-from-the-online-dashboard
- Shopify POS features: https://www.shopify.com/pos/features
- Loyverse POS features: https://loyverse.com/pos-features
- Lightspeed Retail features: https://www.lightspeedhq.com/pos/retail/
- Safaricom Daraja M-Pesa API: https://developer.safaricom.co.ke/
- KRA eTIMS Integration Guide: https://www.kra.go.ke/business/etims-electronic-tax-invoice-management-system/learn-about-etims/etims-system-to-system-integration
- Africa's Talking SMS API: https://africastalking.com/sms
