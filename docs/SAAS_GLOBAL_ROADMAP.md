# Global Multi-Tenant SaaS POS Blueprint

This architecture blueprint details how to convert the POS System into a **Global SaaS Platform** to sell subscription plans to retail stores, supermarkets, restaurants, and businesses worldwide.

---

## 🏗️ 1. Multi-Tenant Architecture (`tenantId` Isolation)

In a multi-tenant SaaS, hundreds of independent businesses share the same application code and database, but their data is strictly isolated by a `tenantId`.

### Models Schema Update
Add `tenantId` to all core tables:

```js
// Example: Product model with multi-tenancy
Product.define('Product', {
  tenantId: {
    type: DataTypes.UUID,
    allowNull: false,
    index: true
  },
  sku: { type: DataTypes.STRING, allowNull: false },
  name: { type: DataTypes.STRING, allowNull: false }
  // ...
});
```

### Affected Tables
- `users`, `products`, `categories`, `orders`, `order_items`, `payments`
- `customers`, `shifts`, `audit_logs`, `suppliers`, `purchase_orders`, `promotions`

---

## 💳 2. Subscription Tiers & Billing

Integrate **Stripe** (Global Credit Cards/Apple Pay) and **Flutterwave / M-Pesa** (East Africa) for recurring monthly/annual subscription billing.

| Plan Tier | Price (Global / Local) | Features Included |
|---|---|---|
| **Starter** | $29/mo or KES 3,500/mo | 1 Register, 100 Products, Basic Reporting |
| **Growth** | $79/mo or KES 8,500/mo | 3 Registers, Unlimited Products, Suppliers & POs, Loyalty Program, CSV Exports |
| **Enterprise** | $199/mo or KES 22,000/mo | Unlimited Registers, Multi-Branch Stock Transfer, Custom Domain, Dedicated Support |

---

## 🌐 3. Self-Serve Business Onboarding (`/signup`)

1. **Sign Up Landing Page**:
   - Business owner enters Business Name, Email, Country, Currency (USD, KES, EUR, GBP), and Password.
2. **Automated Provisioning**:
   - Creates a new `Tenant` record with default categories, demo seed data, and super-admin owner credentials.
3. **Subdomain / Store Selection**:
   - Owner gets a dedicated store URL (e.g., `joes-supermarket.yourpos.com` or login via tenant ID).

---

## 👑 4. Platform Owner Super-Admin Portal (`/super-admin`)

A master management dashboard for you (the SaaS owner) to:
- Monitor **Total MRR (Monthly Recurring Revenue)** and Active Subscribers.
- View and manage all registered stores.
- Manually activate, suspend, or upgrade business accounts.
- Set global platform pricing and feature flags.

---

## 🔒 5. International Compliance & Localization

- **Multi-Currency**: Allow stores to select default currency (KES, USD, EUR, GBP, UGX, TZS, etc.).
- **Multi-Tax Systems**: Configurable VAT/GST rates per country.
- **Localized Payments**: Safaricom M-Pesa (Kenya), MTN Mobile Money (Uganda/Ghana), Stripe (US/EU), Flutterwave (Nigeria/Global).
