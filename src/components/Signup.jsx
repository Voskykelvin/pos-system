'use client';

import { useEffect, useState } from 'react';
import styles from './Signup.module.css';

const fallbackPlans = [
  { id: 'starter', name: 'Starter', priceUsd: 29 },
  { id: 'growth', name: 'Growth', priceUsd: 79 },
  { id: 'enterprise', name: 'Enterprise', priceUsd: 199 }
];

function planLabel(plan) {
  return `${plan.name} - $${Number(plan.priceUsd || 0).toFixed(0)}/mo`;
}

export default function Signup({ initialPlan = 'starter', onSignupSuccess, onNavigateLogin, onNavigateHome }) {
  const [form, setForm] = useState({
    businessName: '',
    email: '',
    password: '',
    currency: 'KES',
    plan: initialPlan
  });

  const [plans, setPlans] = useState(fallbackPlans);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    setForm((current) => ({ ...current, plan: initialPlan }));
  }, [initialPlan]);

  useEffect(() => {
    let active = true;

    async function loadPlans() {
      try {
        const res = await fetch('/api/plans');
        const data = await res.json();
        if (active && res.ok && Array.isArray(data.plans)) {
          setPlans(data.plans);
        }
      } catch {
        // Fallback plans keep signup usable in static previews.
      }
    }

    loadPlans();
    return () => {
      active = false;
    };
  }, []);

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
          <div className={styles.badge}>Jijenge POS Platform</div>
          <h1 className={styles.title}>Create your store</h1>
          <p className={styles.subtitle}>
            Use this if you own the shop. We will create the store and your admin account.
          </p>
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
              Plan
              <select
                className={styles.select}
                value={form.plan}
                onChange={(e) => setForm({ ...form, plan: e.target.value })}
              >
                {plans.map((plan) => (
                  <option key={plan.id} value={plan.id}>{planLabel(plan)}</option>
                ))}
              </select>
            </label>
          </div>

          <button type="submit" className={styles.submitBtn} disabled={loading}>
            {loading ? 'Creating store...' : 'Create my Jijenge store'}
          </button>
        </form>

        <div className={styles.footer}>
          Already added as staff?{' '}
          <button className={styles.linkBtn} onClick={onNavigateLogin}>
            Sign in
          </button>
          {onNavigateHome && (
            <>
              <span className={styles.footerDivider}>or</span>
              <button className={styles.linkBtn} onClick={onNavigateHome}>
                return home
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
