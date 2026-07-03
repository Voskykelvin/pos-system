import { useEffect, useMemo, useState } from 'react';
import Checkout from './components/Checkout.jsx';
import ProductAdmin from './components/ProductAdmin.jsx';
import Dashboard from './components/Dashboard.jsx';
import Analytics from './components/Analytics.jsx';
import Login from './components/Login.jsx';
import Operations from './components/Operations.jsx';
import styles from './App.module.css';

const ROUTES = {
  '/': 'dashboard',
  '/checkout': 'checkout',
  '/inventory': 'inventory',
  '/analytics': 'analytics',
  '/operations': 'operations'
};

const NAV_ITEMS = [
  { id: 'dashboard', label: 'Dashboard', path: '/', roles: ['admin', 'manager'] },
  { id: 'checkout', label: 'Checkout', path: '/checkout', roles: ['admin', 'manager', 'cashier'] },
  { id: 'inventory', label: 'Inventory', path: '/inventory', roles: ['admin', 'manager'] },
  { id: 'analytics', label: 'Analytics', path: '/analytics', roles: ['admin', 'manager'] },
  { id: 'operations', label: 'Operations', path: '/operations', roles: ['admin', 'manager', 'cashier'] }
];

function getInitialView() {
  return ROUTES[window.location.pathname] || 'dashboard';
}

export default function App() {
  const [view, setView] = useState(getInitialView);
  const [authToken, setAuthToken] = useState(() => localStorage.getItem('pos_auth_token'));
  const [authReady, setAuthReady] = useState(false);
  const [bootstrap, setBootstrap] = useState({
    userId: null,
    cashierId: null,
    demoMode: false,
    user: null
  });

  useEffect(() => {
    async function loadBootstrap() {
      if (!authToken) {
        setAuthReady(true);
        return;
      }

      try {
        const res = await fetch('/api/bootstrap', {
          headers: { Authorization: `Bearer ${authToken}` }
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Session expired');
        setBootstrap(data);
      } catch {
        localStorage.removeItem('pos_auth_token');
        setAuthToken(null);
      } finally {
        setAuthReady(true);
      }
    }

    loadBootstrap();
  }, [authToken]);

  useEffect(() => {
    const onPop = () => setView(getInitialView());
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const activePath = useMemo(() => {
    const item = NAV_ITEMS.find((navItem) => navItem.id === view);
    return item?.path || '/';
  }, [view]);

  const visibleNavItems = useMemo(() => {
    const role = bootstrap.user?.role;
    if (!role) return [];
    return NAV_ITEMS.filter((item) => item.roles.includes(role));
  }, [bootstrap.user]);

  useEffect(() => {
    if (!visibleNavItems.length) return;
    const current = visibleNavItems.find((item) => item.id === view);
    if (!current) {
      navigate(visibleNavItems[0]);
    }
  }, [visibleNavItems, view]);

  function navigate(item) {
    setView(item.id);
    if (window.location.pathname !== item.path) {
      window.history.pushState({}, '', item.path);
    }
  }

  function handleLogin({ token, user }) {
    localStorage.setItem('pos_auth_token', token);
    setAuthToken(token);
    setBootstrap({
      userId: user.id,
      cashierId: user.id,
      user,
      demoMode: window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost'
    });
  }

  function handleLogout() {
    localStorage.removeItem('pos_auth_token');
    setAuthToken(null);
    setBootstrap({ userId: null, cashierId: null, user: null, demoMode: false });
    window.history.pushState({}, '', '/');
    setView('dashboard');
  }

  if (!authReady) {
    return <div className={styles.loading}>Loading POS...</div>;
  }

  if (!authToken || !bootstrap.user) {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <div className={styles.shell}>
      <aside className={styles.sidebar}>
        <div className={styles.brand}>
          <span className={styles.brandMark}>P</span>
          <div>
            <div className={styles.brandName}>POS System</div>
            <div className={styles.brandMeta}>{bootstrap.demoMode ? 'Demo store' : 'Live store'}</div>
          </div>
        </div>

        <nav className={styles.nav} aria-label="Primary">
          {visibleNavItems.map((item) => (
            <button
              key={item.id}
              className={`${styles.navButton} ${view === item.id ? styles.active : ''}`}
              onClick={() => navigate(item)}
              type="button"
            >
              {item.label}
            </button>
          ))}
        </nav>

        <div className={styles.statusBox}>
          <div className={styles.statusLabel}>{bootstrap.user.role}</div>
          <div className={styles.statusValue}>{bootstrap.user.name}</div>
          <button className={styles.logoutBtn} type="button" onClick={handleLogout}>
            Sign out
          </button>
        </div>
      </aside>

      <main className={styles.main}>
        {view === 'dashboard' && <Dashboard authToken={authToken} />}
        {view === 'checkout' && (
          <Checkout authToken={authToken} cashierId={bootstrap.cashierId} user={bootstrap.user} />
        )}
        {view === 'inventory' && <ProductAdmin authToken={authToken} userId={bootstrap.userId} />}
        {view === 'analytics' && <Analytics authToken={authToken} />}
        {view === 'operations' && <Operations authToken={authToken} user={bootstrap.user} />}
      </main>
    </div>
  );
}
