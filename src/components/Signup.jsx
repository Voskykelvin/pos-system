'use client';

import { useState } from 'react';
import styles from './Signup.module.css';

export default function Signup({ onSignupSuccess, onNavigateLogin }) {
  const [form, setForm] = useState({
    businessName: '',
    email: '',
    password: '',
    currency: 'KES',
    plan: 'starter'
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Registration failed');

      onSignupSuccess(data.token, data.user, data.tenant);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <div className={styles.header}>
          <div className={styles.badge}>SaaS POS Platform</div>
          <h1 className={styles.title}>Launch Your Store</h1>
          <p className={styles.subtitle}>Start your 14-day free trial. No credit card required.</p>
        </div>

        {error && <div className={styles.errorAlert}>{error}</div>}

        <form onSubmit={handleSubmit} className={styles.form}>
          <label className={styles.label}>
            Business Name *
            <input
              type="text"
              className={styles.input}
              placeholder="e.g. Acme Supermarket"
              value={form.businessName}
              onChange={(e) => setForm({ ...form, businessName: e.target.value })}
              required
            />
          </label>

          <label className={styles.label}>
            Owner Email Address *
            <input
              type="email"
              className={styles.input}
              placeholder="owner@store.com"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              required
            />
          </label>

          <label className={styles.label}>
            Password *
            <input
              type="password"
              className={styles.input}
              placeholder="At least 6 characters"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              required
            />
          </label>

          <div className={styles.row}>
            <label className={styles.label}>
              Operating Currency
              <select
                className={styles.select}
                value={form.currency}
                onChange={(e) => setForm({ ...form, currency: e.target.value })}
              >
                <option value="KES">KES (Kenyan Shilling)</option>
                <option value="USD">USD (US Dollar)</option>
                <option value="EUR">EUR (Euro)</option>
                <option value="GBP">GBP (British Pound)</option>
                <option value="UGX">UGX (Ugandan Shilling)</option>
                <option value="TZS">TZS (Tanzanian Shilling)</option>
              </select>
            </label>

            <label className={styles.label}>
              Subscription Tier
              <select
                className={styles.select}
                value={form.plan}
                onChange={(e) => setForm({ ...form, plan: e.target.value })}
              >
                <option value="starter">Starter Plan ($29/mo)</option>
                <option value="growth">Growth Plan ($79/mo)</option>
                <option value="enterprise">Enterprise Plan ($199/mo)</option>
              </select>
            </label>
          </div>

          <button type="submit" className={styles.submitBtn} disabled={loading}>
            {loading ? 'Provisioning Store...' : '🚀 Launch My POS Store'}
          </button>
        </form>

        <div className={styles.footer}>
          Already have an account?{' '}
          <button className={styles.linkBtn} onClick={onNavigateLogin}>
            Sign in here
          </button>
        </div>
      </div>
    </div>
  );
}
