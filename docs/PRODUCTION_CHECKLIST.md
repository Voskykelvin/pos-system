# Production Go-Live Master Checklist

Use this checklist when deploying the POS system to production on Render with PostgreSQL.

---

## Phase 1: Hosting & Database Infrastructure (Render)

- [ ] **Render Account Setup**: Log in to [Render.com](https://render.com).
- [ ] **Managed PostgreSQL Database**:
  - Provision a Render PostgreSQL instance (Region: Oregon or Frankfurt).
  - Copy the internal database URL (`DATABASE_URL`).
- [ ] **Web Service Provisioning**:
  - Connect your GitHub repository `Voskykelvin/pos-system`.
  - Build Command: `npm install && npm run build`
  - Start Command: `npm start`
  - Health Check Path: `/api/health`

---

## Phase 2: Environment Variables & Secrets Configuration

Configure these parameters in **Render Web Service -> Environment**:

### Core Application & Security
- [ ] `NODE_ENV` = `production`
- [ ] `PORT` = `4000`
- [ ] `DATABASE_URL` = `postgres://user:password@host/dbname`
- [ ] `JWT_SECRET` = `[Generate a random 64-character secret]`
- [ ] `BUSINESS_TIME_ZONE` = `Africa/Nairobi`

### Business & Tax Details
- [ ] `BUSINESS_NAME` = `[Your Legal Business Name]`
- [ ] `BUSINESS_KRA_PIN` = `[Your Official KRA PIN, e.g. P051234567Z]`
- [ ] `LOYALTY_POINTS_PER_100` = `1` (1 point earned per KES 100 spent)
- [ ] `LOYALTY_POINTS_PER_KES` = `100` (100 points = KES 1.00 discount)

### M-Pesa Daraja Integration (Safaricom)
- [ ] `MPESA_ENV` = `production`
- [ ] `MPESA_CONSUMER_KEY` = `[From Safaricom Developer Portal]`
- [ ] `MPESA_CONSUMER_SECRET` = `[From Safaricom Developer Portal]`
- [ ] `MPESA_SHORTCODE` = `[Paybill or Till Number]`
- [ ] `MPESA_PASSKEY` = `[Online Passkey]`
- [ ] `MPESA_CALLBACK_URL` = `https://your-app.onrender.com/api/mpesa/callback`

### KRA eTIMS Tax Integration
- [ ] `ETIMS_ENV` = `production`
- [ ] `ETIMS_BASE_URL` = `[KRA VSCU / OSCU Endpoint]`
- [ ] `ETIMS_API_KEY` = `[Issued KRA API Key]`
- [ ] `ETIMS_DEVICE_SERIAL` = `[KRA Registered Device Serial]`
- [ ] `ENABLE_ETIMS_SCHEDULER` = `true`

### Africa's Talking SMS (Optional for Digital Receipts)
- [ ] `AFRICASTALKING_USERNAME` = `[Username or sandbox]`
- [ ] `AFRICASTALKING_API_KEY` = `[API Key]`
- [ ] `AFRICASTALKING_SENDER_ID` = `[Sender Shortcode / ID]`

---

## Phase 3: Database Migrations & First Admin Setup

Run these commands inside **Render Web Service -> Shell**:

- [ ] **Execute Database Migrations**:
  ```bash
  npm run db:migrate
  ```
- [ ] **Bootstrap First Super-Admin**:
  ```bash
  ADMIN_NAME="Store Owner" ADMIN_EMAIL="owner@yourstore.com" ADMIN_PASSWORD="[SecurePassword123]" npm run admin:create
  ```

---

## Phase 4: Hardware & Register Setup

- [ ] **Thermal Receipt Printer**:
  - Connect printer via USB or Network.
  - Set default paper size to 80mm / 58mm in browser print dialog.
- [ ] **Cash Drawer**:
  - Plug RJ11/RJ12 cable from cash drawer into back of thermal printer.
- [ ] **Barcode Scanner**:
  - Plug USB barcode scanner into register terminal (no driver required).

---

## Phase 5: Launch Day Smoke Test & Verification

- [ ] **Health Check Verification**:
  - Open `https://your-app.onrender.com/api/health`
  - Confirm response: `{"ok": true, "database": "postgres"}`
- [ ] **Staff Login Test**: Log in with initial Admin credentials.
- [ ] **Product Intake**: Add or import initial inventory catalog via CSV (`ProductAdmin -> CSV Tools`).
- [ ] **Shift Opening**: Open initial register shift with starting cash float.
- [ ] **Test Transaction**:
  - Scan barcode using physical scanner -> Verify product added to cart.
  - Perform test sale (Cash) -> Verify thermal receipt prints & cash drawer pops open.
  - Perform test sale (M-Pesa) -> Verify STK push prompt arrives on mobile phone.
- [ ] **Shift Closing & Report**: Close shift and verify cash reconciliation in Operations.
