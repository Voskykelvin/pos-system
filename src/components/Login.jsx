import { useState } from 'react';
import styles from './Login.module.css';

export default function Login({ onLogin, onLoginSuccess, onNavigateHome }) {
  const [identifier, setIdentifier] = useState('admin@example.local');
  const [password, setPassword] = useState('admin12345');
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
        body: JSON.stringify({ identifier, password })
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'Login failed');
      const callback = onLogin || onLoginSuccess;
      if (callback) callback(payload);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className={styles.page}>
      {onNavigateHome && (
        <button className={styles.homeLink} type="button" onClick={onNavigateHome}>
          Back to homepage
        </button>
      )}
      <section className={styles.panel}>
        <div className={styles.brandMark}>P</div>
        <h1>Jijenge POS</h1>
        <p>Sign in with your staff account.</p>

        <form className={styles.form} onSubmit={handleSubmit}>
          <label>
            Email or phone
            <input
              value={identifier}
              onChange={(event) => setIdentifier(event.target.value)}
              autoComplete="username"
              required
            />
          </label>
          <label>
            Password
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              required
            />
          </label>
          <button type="submit" disabled={submitting}>
            {submitting ? 'Signing in...' : 'Sign in'}
          </button>
        </form>

        {error && <div className={styles.error}>{error}</div>}
        <div className={styles.demoHint}>
          Demo: admin@example.local / admin12345
        </div>
      </section>
    </main>
  );
}
