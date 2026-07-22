import { useState } from 'react';
import {
  BUILDER_NAME,
  BUILDER_PHONE_DISPLAY,
  BUILDER_WHATSAPP_URL
} from '../utils/builderContact';

export default function Signup({ initialPlan = 'starter', onSignupSuccess, onNavigateLogin, onNavigateHome }) {
  const [form, setForm] = useState({
    businessName: '',
    email: '',
    phone: '',
    password: '',
    currency: 'KES',
    timezone: 'Africa/Nairobi',
    plan: initialPlan
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || 'Signup failed');
      }

      onSignupSuccess?.(data.token, data.user, data.tenant);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="login-page">
      {/* Visual panel - desktop only */}
      <div className="visualPanel">
        <h2 className="visualTitle">Start selling<br />in minutes.</h2>
        <p className="visualSubtitle">
          Join the Jijenge POS platform to manage stock, sales, and staff from one powerful workspace.
        </p>
      </div>

      {/* Form panel */}
      <div className="formContainer">
        <section className="panel" style={{ width: '100%', maxWidth: '420px' }}>
          {onNavigateHome && (
            <button className="homeLink" type="button" onClick={onNavigateHome}>
              &larr; Back to homepage
            </button>
          )}

          <div style={{ marginBottom: 'var(--space-6)' }}>
            <div className="brandMark">J</div>
            <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: 'var(--text-2xl)', fontWeight: 700, margin: 'var(--space-2) 0' }}>Sign up</h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-sm)' }}>
              Create your shop account now.
            </p>
          </div>

          {error && (
            <div className="error" style={{ marginBottom: 'var(--space-4)' }}>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="form">
            <label>
              Business Name
              <input
                type="text"
                placeholder="e.g. Acme Supermarket"
                value={form.businessName}
                onChange={(e) => setForm({ ...form, businessName: e.target.value })}
                required
              />
            </label>

            <label>
              Owner Email Address
              <input
                type="email"
                placeholder="owner@store.com"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                required
              />
            </label>

            <label>
              Owner Password
              <input
                type="password"
                placeholder="At least 6 characters"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                required
              />
            </label>

            <button type="submit" className="btn-primary" style={{ height: 48, fontSize: 'var(--text-base)', marginTop: 'var(--space-2)' }} disabled={loading}>
              {loading ? 'Creating store...' : 'Create my Jijenge store'}
            </button>
          </form>

          <div style={{ marginTop: 'var(--space-6)', textAlign: 'center', fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
            Already have an account?{' '}
            <button onClick={onNavigateLogin} style={{ background: 'none', border: 'none', color: 'var(--brand)', fontWeight: 700, cursor: 'pointer', padding: 0 }}>
              Sign in instead
            </button>
          </div>

          <div className="builderCredit">
            <div>
              <span>System built by {BUILDER_NAME}</span>
              <a href={BUILDER_WHATSAPP_URL} target="_blank" rel="noreferrer">
                {BUILDER_PHONE_DISPLAY} WhatsApp
              </a>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
