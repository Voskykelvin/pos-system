# Subscription Billing MVP

## Product Decision

Jijenge POS now uses a register-first, pay-to-continue SaaS flow:

- The owner creates a store account at `/signup`.
- The tenant is created as `pending_payment`.
- The owner lands on `/billing`.
- Manual M-Pesa, Till, PayBill, bank, or gateway instructions are shown from platform environment variables.
- The owner submits a payment reference.
- The platform owner confirms the reference in `/super-admin`.
- Confirmation activates the tenant and extends the subscription by 30 days.
- Pending, past-due, or suspended tenants can log in only to `/billing` and recovery endpoints.

This keeps onboarding low-friction while preventing unpaid workspace usage.

## Kenya Payment Direction

The MVP should lead with M-Pesa because it is the default local payment habit and the existing app already has M-Pesa foundations. The recommended rollout path is:

1. Manual M-Pesa phone number while the product is still validating subscriptions.
2. M-Pesa Till or PayBill for cleaner customer trust and reconciliation.
3. Daraja STK Push for direct automation, or a gateway if cards, Apple Pay, bank transfer, or multi-currency collection becomes important.

Gateways to evaluate for the next phase:

- Safaricom Daraja for direct M-Pesa STK Push and callbacks.
- Pesapal for M-Pesa plus card acceptance and payment links.
- Paystack for M-Pesa, cards, Apple Pay, settlement, and recurring/subscription tooling.
- IntaSend for M-Pesa STK Push, payment forms, and webhook notifications.
- Flutterwave or DPO for broader African, card, and multi-currency coverage.

Sendwave should not be treated as the primary subscription processor unless it exposes the merchant APIs, settlement, and webhook reconciliation needed by this app.

## Operational Notes

- Platform payment channels are configured with `PLATFORM_*` environment variables.
- Tenant subscription payments are stored in `subscription_payments`.
- Tenant fast lookup fields are `subscriptionStartedAt`, `subscriptionEndsAt`, and `status`.
- Super-admin dashboard returns `subscriptionAlerts` and `subscriptionPayments.pendingReview`.
- Automated provider webhooks should update the same `subscription_payments` rows and use the same activation logic as manual confirmation.
