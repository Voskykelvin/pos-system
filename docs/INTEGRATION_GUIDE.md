# Integration Guide

This guide explains how to configure and configure M-Pesa API integration, KRA eTIMS, and subscription billing options.

## 1. M-Pesa Integration (Safaricom Daraja API)

Jijenge POS supports automated payment confirmation and STK push prompts for checkout transactions.

### Manual Setup Steps:
1. **Developer Portal Registration:**
   - Go to [Safaricom Developer Portal](https://developer.safaricom.co.ke/) and create an account.
2. **Create App:**
   - Go to "My Apps", create a new app, and check both **Lipa Na M-Pesa Sandbox** and **M-Pesa Express Sandbox**.
   - Note down the generated **Consumer Key** and **Consumer Secret**.
3. **Register URLs (C2B / STK):**
   - For STK push callback, Safaricom needs to call your API endpoint. Configure `MPESA_CALLBACK_URL` to match `https://yourdomain.com/api/mpesa/callback`.
4. **Go-Live Production Promotion:**
   - Go to "Go Live" section of Daraja.
   - Enter your Business Paybill or Till Number, upload documentation, and generate production keys.
   - Enter the live credentials into your server environment variables or per-tenant settings.

---

## 2. KRA eTIMS (Kenya Revenue Authority Electronic Tax Invoice Management System)

Compliance with KRA invoicing requirements is managed via scheduler sync worker.

### Manual Setup Steps:
1. **Device Serial Registration:**
   - Register your business profile on the KRA eTIMS portal.
   - Request or obtain a virtual sales control unit device serial key from KRA or an authorized intermediary.
2. **API Endpoint Configuration:**
   - Provide the KRA API gateway address in `ETIMS_BASE_URL` (sandbox: `https://etims-sb.kra.go.ke` or intermediate proxy URL).
3. **API Key Generation:**
   - Generate your API access key from the eTIMS portal and set it to `ETIMS_API_KEY`.
4. **Testing Connection:**
   - Use `POST /api/etims/sync` to verify connection and sync logic.

---

## 3. Subscription Billing Configuration

The SaaS Owner dashboard allows verifying and activating store subscription payments.

### Manual Setup Steps:
1. **Merchant Billing Setup:**
   - Configure your business M-Pesa Till or PayBill details in the main server environment variables (`PLATFORM_MPESA_PHONE`, `PLATFORM_MPESA_TILL`, or `PLATFORM_MPESA_PAYBILL`).
2. **Onboarding Tenant Verification:**
   - When a tenant registers, they receive billing instructions on the subscription payment screen based on your global settings.
   - The tenant pays manually and submits their reference ID.
3. **Admin Verification Process:**
   - Go to the SaaS Admin panel.
   - Check pending subscription payments.
   - Verify that the reference code matches your Safaricom or bank statements.
   - Click "Confirm" to activate the tenant store.
