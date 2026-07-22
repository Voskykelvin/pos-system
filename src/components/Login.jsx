import { useState } from 'react';
import {
  BUILDER_NAME,
  BUILDER_PHONE_DISPLAY,
  BUILDER_WHATSAPP_URL
} from '../utils/builderContact';

export default function Login({ onLogin, onNavigateHome }) {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [mfaCode, setMfaCode] = useState('');
  const [mfaRequired, setMfaRequired] = useState(false);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier, password, ...(mfaRequired ? { mfaCode } : {}) })
      });
      const payload = await response.json();
      if (!response.ok) {
        if (payload.mfaRequired) setMfaRequired(true);
        throw new Error(payload.error || 'Login failed');
      }
      onLogin?.(payload);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="login-page">
      {/* Visual panel - desktop only */}
      <div className="visualPanel">
        <h2 className="visualTitle">Run your store<br />with confidence.</h2>
        <p className="visualSubtitle">
          Checkout, inventory, M-Pesa payments, and eTIMS compliance - all in one place.
        </p>
      </div>

      {/* Form panel */}
      <div className="formContainer">
        <section className="panel">
          {onNavigateHome && (
            <button className="homeLink" type="button" onClick={onNavigateHome}>
              &larr; Back to homepage
            </button>
          )}
          <div className="brandMark">J</div>
          <h1>Jijenge POS</h1>
          <p>Log in to run your store.</p>

          <form className="form" onSubmit={handleSubmit}>
            <label htmlFor="login-identifier">
              Email or phone
              <input
                id="login-identifier"
                value={identifier}
                onChange={(event) => setIdentifier(event.target.value)}
                autoComplete="username"
                required
              />
            </label>
            {mfaRequired && (
              <label htmlFor="login-mfa">
                Authenticator code
                <input
                  id="login-mfa"
                  value={mfaCode}
                  onChange={(event) => setMfaCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  pattern="[0-9]{6}"
                  required
                  autoFocus
                />
              </label>
            )}
            <label htmlFor="login-password">
              Password
              <input
                id="login-password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="current-password"
                required
              />
            </label>
            {error && <div className="error">{error}</div>}
            <button type="submit" disabled={submitting}>
              {submitting ? 'Signing in...' : 'Sign in'}
            </button>
          </form>

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
