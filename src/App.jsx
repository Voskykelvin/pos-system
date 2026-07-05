import { useEffect, useMemo, useState } from 'react';
import Checkout from './components/Checkout.jsx';
import ProductAdmin from './components/ProductAdmin.jsx';
import Dashboard from './components/Dashboard.jsx';
import Analytics from './components/Analytics.jsx';
import Login from './components/Login.jsx';
import Operations from './components/Operations.jsx';
import CustomerAdmin from './components/CustomerAdmin.jsx';
import Signup from './components/Signup.jsx';
import SuperAdmin from './components/SuperAdmin.jsx';
import Homepage from './components/Homepage.jsx';
import styles from './App.module.css';
import { syncOfflineOrders } from './utils/offlineQueue';

const ROUTES = {
  '/home': 'home',
  '/': 'dashboard',
  '/checkout': 'checkout',
  '/inventory': 'inventory',
  '/analytics': 'analytics',
  '/customers': 'customers',
  '/operations': 'operations',
  '/super-admin': 'saas_owner'
};

const AUTH_ROUTES = {
  '/login': 'login',
  '/signup': 'signup'
};

const NAV_ITEMS = [
  { id: 'dashboard', label: 'Dashboard', path: '/', roles: ['admin', 'manager'] },
  { id: 'checkout', label: 'Checkout', path: '/checkout', roles: ['admin', 'manager', 'cashier'] },
  { id: 'inventory', label: 'Inventory', path: '/inventory', roles: ['admin', 'manager'] },
  { id: 'analytics', label: 'Analytics', path: '/analytics', roles: ['admin', 'manager'], feature: 'advanced_analytics' },
  { id: 'customers', label: 'Customers', path: '/customers', roles: ['admin', 'manager'], feature: 'customer_credit' },
  { id: 'operations', label: 'Operations', path: '/operations', roles: ['admin', 'manager', 'cashier'] },
  { id: 'saas_owner', label: 'Platform SaaS', path: '/super-admin', roles: ['super_admin'] }
];

function getInitialView() {
  return ROUTES[window.location.pathname] || 'dashboard';
}

function getInitialAuthMode() {
  return AUTH_ROUTES[window.location.pathname] || null;
}

function isProtectedAppPath(pathname) {
  const route = ROUTES[pathname];
  return Boolean(route && route !== 'home' && pathname !== '/');
}

export default function App() {
  const [view, setView] = useState(getInitialView);
  const [authMode, setAuthMode] = useState(getInitialAuthMode);
  const [authToken, setAuthToken] = useState(() => localStorage.getItem('pos_auth_token'));
  const [authReady, setAuthReady] = useState(false);
  const [bootstrap, setBootstrap] = useState({
    userId: null,
    cashierId: null,
    demoMode: false,
    user: null,
    tenant: null
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
    const onPop = () => {
      setAuthMode(getInitialAuthMode());
      setView(getInitialView());
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  useEffect(() => {
    if (!authToken) return;

    async function handleOnline() {
      console.log('Back online! Syncing offline orders...');
      const { synced, failed } = await syncOfflineOrders(authToken);
      if (synced > 0) {
        alert(`Successfully synced ${synced} offline order(s).`);
      }
      if (failed > 0) {
        alert(`Failed to sync ${failed} offline order(s). They will be retried later.`);
      }
    }

    window.addEventListener('online', handleOnline);
    // Also try syncing when the workspace loads (if already online)
    if (navigator.onLine) {
      handleOnline();
    }

    return () => window.removeEventListener('online', handleOnline);
  }, [authToken]);

  const visibleNavItems = useMemo(() => {
    const role = bootstrap.user?.role;
    if (!role) return [];
    const enabledFeatures = bootstrap.tenant?.enabledFeatures || [];
    return NAV_ITEMS.filter((item) => (
      item.roles.includes(role) &&
      (!item.feature || !bootstrap.tenant || enabledFeatures.includes(item.feature))
    ));
  }, [bootstrap.user, bootstrap.tenant]);

  const allowedIds = visibleNavItems.map((i) => i.id);

  useEffect(() => {
    if (!visibleNavItems.length) return;
    if (view === 'home') return;
    const current = visibleNavItems.find((item) => item.id === view);
    if (!current) {
      navigate(visibleNavItems[0]);
    }
  }, [visibleNavItems, view]);

  function navigate(item) {
    setAuthMode(null);
    setView(item.id);
    if (window.location.pathname !== item.path) {
      window.history.pushState({}, '', item.path);
    }
  }

  function goToMasterHomepage() {
    setAuthMode(null);
    setView('home');
    if (window.location.pathname !== '/home') {
      window.history.pushState({}, '', '/home');
    }
  }

  function goToAppLanding() {
    const landing = visibleNavItems[0] || NAV_ITEMS[0];
    navigate(landing);
  }

  function handleLogout() {
    localStorage.removeItem('pos_auth_token');
    setAuthToken(null);
    setBootstrap({ userId: null, cashierId: null, user: null, tenant: null, demoMode: false });
    setAuthMode(null);
    window.history.pushState({}, '', '/');
    setView('dashboard');
  }

  const [signupPlan, setSignupPlan] = useState('starter');
  const requestedProtectedLogin = !authToken && !authMode && isProtectedAppPath(window.location.pathname);

  function goToSignup(planId = 'starter') {
    setSignupPlan(planId);
    setAuthMode('signup');
    if (window.location.pathname !== '/signup') {
      window.history.pushState({}, '', '/signup');
    }
  }

  function goToLogin() {
    setAuthMode('login');
    if (window.location.pathname !== '/login') {
      window.history.pushState({}, '', '/login');
    }
  }

  if (!authReady) {
    return <div className={styles.loading}>Loading workspace...</div>;
  }

  if (authToken && !bootstrap.user) {
    return <div className={styles.loading}>Loading workspace...</div>;
  }

  if (authMode === 'signup' && !authToken) {
    return (
      <Signup
        initialPlan={signupPlan}
        onSignupSuccess={(token, user) => {
          localStorage.setItem('pos_auth_token', token);
          setAuthReady(false);
          setAuthToken(token);
          setAuthMode(null);
          setView('dashboard');
          window.history.replaceState({}, '', '/');
        }}
        onNavigateLogin={() => {
          goToLogin();
        }}
        onNavigateHome={() => {
          goToMasterHomepage();
        }}
      />
    );
  }

  if ((authMode === 'login' || requestedProtectedLogin) && !authToken) {
    return (
      <Login
        onLogin={(payload) => {
          const token = typeof payload === 'string' ? payload : payload.token;
          localStorage.setItem('pos_auth_token', token);
          setAuthToken(token);
          setAuthMode(null);
          if (payload.user) {
            setBootstrap({
            userId: payload.user.id,
            cashierId: payload.user.id,
            user: payload.user,
            tenant: payload.tenant || null
          });
          }
          window.history.replaceState({}, '', '/');
        }}
        onNavigateHome={goToMasterHomepage}
      />
    );
  }

  if (!authToken) {
    return (
      <Homepage
        onNavigateLogin={goToLogin}
        onNavigateSignup={goToSignup}
      />
    );
  }

  if (view === 'home') {
    return (
      <Homepage
        isAuthenticated
        accountActionLabel="Back to workspace"
        onNavigateLogin={goToAppLanding}
        onNavigateSignup={goToAppLanding}
      />
    );
  }

  return (
    <div className={styles.shell}>
      <aside className={styles.sidebar}>
        <button className={styles.brand} type="button" onClick={goToMasterHomepage} aria-label="Open master homepage">
          <span className={styles.brandMark}>J</span>
          <div>
            <div className={styles.brandName}>Jijenge POS</div>
            <div className={styles.brandMeta}>{bootstrap.demoMode ? 'Sample workspace' : 'Live store'}</div>
          </div>
        </button>

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
        {view === 'inventory' && allowedIds.includes('inventory') && (
          <ProductAdmin authToken={authToken} userId={bootstrap.userId} tenant={bootstrap.tenant} />
        )}
        {view === 'analytics' && allowedIds.includes('analytics') && (
          <Analytics authToken={authToken} />
        )}
        {view === 'operations' && allowedIds.includes('operations') && (
          <Operations authToken={authToken} user={bootstrap.user} />
        )}
        {view === 'customers' && allowedIds.includes('customers') && (
          <CustomerAdmin authToken={authToken} user={bootstrap.user} />
        )}
        {view === 'saas_owner' && allowedIds.includes('saas_owner') && (
          <SuperAdmin authToken={authToken} />
        )}
      </main>
    </div>
  );
}
