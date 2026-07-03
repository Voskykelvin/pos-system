import { useEffect, useMemo, useState } from 'react';
import Checkout from './components/Checkout.jsx';
import ProductAdmin from './components/ProductAdmin.jsx';
import Dashboard from './components/Dashboard.jsx';
import Analytics from './components/Analytics.jsx';
import styles from './App.module.css';

const ROUTES = {
  '/': 'dashboard',
  '/checkout': 'checkout',
  '/inventory': 'inventory',
  '/analytics': 'analytics'
};

const NAV_ITEMS = [
  { id: 'dashboard', label: 'Dashboard', path: '/' },
  { id: 'checkout', label: 'Checkout', path: '/checkout' },
  { id: 'inventory', label: 'Inventory', path: '/inventory' },
  { id: 'analytics', label: 'Analytics', path: '/analytics' }
];

function getInitialView() {
  return ROUTES[window.location.pathname] || 'dashboard';
}

export default function App() {
  const [view, setView] = useState(getInitialView);
  const [bootstrap, setBootstrap] = useState({
    userId: null,
    cashierId: null,
    demoMode: false
  });

  useEffect(() => {
    async function loadBootstrap() {
      try {
        const res = await fetch('/api/bootstrap');
        const data = await res.json();
        setBootstrap(data);
      } catch {
        setBootstrap((current) => current);
      }
    }

    loadBootstrap();
  }, []);

  useEffect(() => {
    const onPop = () => setView(getInitialView());
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const activePath = useMemo(() => {
    const item = NAV_ITEMS.find((navItem) => navItem.id === view);
    return item?.path || '/';
  }, [view]);

  function navigate(item) {
    setView(item.id);
    if (window.location.pathname !== item.path) {
      window.history.pushState({}, '', item.path);
    }
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
          {NAV_ITEMS.map((item) => (
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
          <div className={styles.statusLabel}>Route</div>
          <div className={styles.statusValue}>{activePath}</div>
        </div>
      </aside>

      <main className={styles.main}>
        {view === 'dashboard' && <Dashboard />}
        {view === 'checkout' && <Checkout cashierId={bootstrap.cashierId} />}
        {view === 'inventory' && <ProductAdmin userId={bootstrap.userId} />}
        {view === 'analytics' && <Analytics />}
      </main>
    </div>
  );
}
