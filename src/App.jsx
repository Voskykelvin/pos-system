import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
const Checkout = lazy(() => import('./components/Checkout.jsx'));
const ProductAdmin = lazy(() => import('./components/ProductAdmin.jsx'));
const Dashboard = lazy(() => import('./components/Dashboard.jsx'));
const Analytics = lazy(() => import('./components/Analytics.jsx'));
const Login = lazy(() => import('./components/Login.jsx'));
const Operations = lazy(() => import('./components/Operations.jsx'));
const CustomerAdmin = lazy(() => import('./components/CustomerAdmin.jsx'));
const Signup = lazy(() => import('./components/Signup.jsx'));
const SuperAdmin = lazy(() => import('./components/SuperAdmin.jsx'));
const Homepage = lazy(() => import('./components/Homepage.jsx'));
const StoreAdmin = lazy(() => import('./components/StoreAdmin.jsx'));
const Billing = lazy(() => import('./components/Billing.jsx'));
import ErrorBoundary from './components/ErrorBoundary.jsx';
import styles from './App.module.css';
import { syncOfflineOrders } from './utils/offlineQueue';
import {
  BUILDER_NAME,
  BUILDER_PHONE_DISPLAY,
  BUILDER_TEL_URL,
  BUILDER_WHATSAPP_URL
} from './utils/builderContact';

const ROUTES = {
  '/home': 'home',
  '/billing': 'billing',
  '/store': 'store_admin',
  '/': 'dashboard',
  '/checkout': 'checkout',
  '/inventory': 'inventory',
  '/analytics': 'analytics',
  '/customers': 'customers',
  '/operations': 'operations',
  '/super-admin': 'saas_owner',
  '/super-admin/overview': 'saas_owner',
  '/super-admin/analytics': 'saas_owner',
  '/super-admin/plans': 'saas_owner',
  '/super-admin/subscriptions': 'saas_owner',
  '/super-admin/tenants': 'saas_owner'
};

const AUTH_ROUTES = {
  '/login': 'login',
  '/signup': 'signup'
};

const NAV_ITEMS = [
  { id: 'store_admin', label: 'Store Setup', path: '/store', roles: ['admin', 'manager'] },
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

function landingForUser(user, tenant) {
  if (tenant && tenant.status !== 'active') {
    return { id: 'billing', label: 'Billing', path: '/billing', roles: ['admin', 'manager', 'cashier'] };
  }

  const enabledFeatures = tenant?.enabledFeatures || [];
  return NAV_ITEMS.find((item) => (
    item.roles.includes(user?.role) &&
    (!item.feature || !tenant || enabledFeatures.includes(item.feature))
  )) || NAV_ITEMS[0];
}

export default function App() {
  const [view, setView] = useState(getInitialView);
  const [authMode, setAuthMode] = useState(getInitialAuthMode);
  const [authToken, setAuthToken] = useState(() => localStorage.getItem('pos_auth_token'));
  const [authReady, setAuthReady] = useState(false);
  const [bootstrapRefresh, setBootstrapRefresh] = useState(0);
  const [bootstrap, setBootstrap] = useState({
    userId: null,
    cashierId: null,
    demoMode: false,
    user: null,
    tenant: null
  });
  const [installPrompt, setInstallPrompt] = useState(null);
  const [syncStatus, setSyncStatus] = useState({ type: 'idle', message: '' });
  const syncTimeoutRef = useRef(null);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setInstallPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  }, []);

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
  }, [authToken, bootstrapRefresh]);

  useEffect(() => {
    const onPop = () => {
      setAuthMode(getInitialAuthMode());
      setView(getInitialView());
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  useEffect(() => {
    if (!authToken) {
      setSyncStatus({ type: 'idle', message: '' });
      return undefined;
    }

    function showSyncStatus(nextStatus, hideAfterMs = 0) {
      if (syncTimeoutRef.current) {
        window.clearTimeout(syncTimeoutRef.current);
        syncTimeoutRef.current = null;
      }

      setSyncStatus(nextStatus);
      if (hideAfterMs > 0) {
        syncTimeoutRef.current = window.setTimeout(() => {
          setSyncStatus({ type: 'idle', message: '' });
          syncTimeoutRef.current = null;
        }, hideAfterMs);
      }
    }

    async function handleOnline() {
      showSyncStatus({ type: 'syncing', message: 'Syncing offline transactions...' });
      try {
        const { synced, failed } = await syncOfflineOrders(authToken);
        if (synced > 0 && failed === 0) {
          showSyncStatus({ type: 'success', message: `Synchronized ${synced} sales successfully.` }, 3000);
        } else if (synced > 0 && failed > 0) {
          showSyncStatus({ type: 'error', message: `Synced ${synced} sales, but ${failed} failed. Retrying later.` }, 6000);
        } else if (failed > 0) {
          showSyncStatus({ type: 'error', message: `Sync failed: ${failed} sales queued offline.` }, 6000);
        } else {
          showSyncStatus({ type: 'idle', message: '' });
        }
      } catch {
        showSyncStatus({ type: 'error', message: 'Sync connection error. Retrying later.' }, 6000);
      }
    }

    window.addEventListener('online', handleOnline);
    if (navigator.onLine) {
      handleOnline();
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      if (syncTimeoutRef.current) {
        window.clearTimeout(syncTimeoutRef.current);
        syncTimeoutRef.current = null;
      }
    };
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
    if (!authToken || !bootstrap.user || bootstrap.user.role === 'super_admin') return;
    if (bootstrap.tenant && bootstrap.tenant.status !== 'active' && view !== 'billing') {
      setAuthMode(null);
      setView('billing');
      if (window.location.pathname !== '/billing') {
        window.history.replaceState({}, '', '/billing');
      }
    }
  }, [authToken, bootstrap.user, bootstrap.tenant, view]);

  useEffect(() => {
    if (!visibleNavItems.length) return;
    if (view === 'home') return;
    if (view === 'billing') return;
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
      <Suspense fallback={<div className={styles.loading}>Loading...</div>}>
        <Signup
          initialPlan={signupPlan}
          onSignupSuccess={(token, user, tenant) => {
            localStorage.setItem('pos_auth_token', token);
            setAuthReady(false);
            setAuthToken(token);
            setAuthMode(null);
            setBootstrap((current) => ({
              ...current,
              userId: user?.id || null,
              cashierId: user?.id || null,
              user: user || null,
              tenant: tenant || null
            }));
            setView(tenant?.status === 'active' ? 'store_admin' : 'billing');
            window.history.replaceState({}, '', tenant?.status === 'active' ? '/store' : '/billing');
          }}
          onNavigateLogin={() => {
            goToLogin();
          }}
          onNavigateHome={() => {
            goToMasterHomepage();
          }}
        />
      </Suspense>
    );
  }

  if ((authMode === 'login' || requestedProtectedLogin) && !authToken) {
    return (
      <Suspense fallback={<div className={styles.loading}>Loading...</div>}>
        <Login
          onLogin={(payload) => {
            const token = typeof payload === 'string' ? payload : payload.token;
            localStorage.setItem('pos_auth_token', token);
            setAuthToken(token);
            setAuthMode(null);
            if (payload.user) {
              const landing = landingForUser(payload.user, payload.tenant);
              setBootstrap({
                userId: payload.user.id,
                cashierId: payload.user.id,
                user: payload.user,
                tenant: payload.tenant || null
              });
              setView(landing.id);
              window.history.replaceState({}, '', landing.path);
            } else {
              window.history.replaceState({}, '', '/');
            }
          }}
          onNavigateHome={goToMasterHomepage}
        />
      </Suspense>
    );
  }

  if (!authToken) {
    return (
      <Suspense fallback={<div className={styles.loading}>Loading...</div>}>
        <Homepage
          onNavigateLogin={goToLogin}
          onNavigateSignup={goToSignup}
        />
      </Suspense>
    );
  }

  if (view === 'billing') {
    return (
      <Suspense fallback={<div className={styles.loading}>Loading...</div>}>
        <Billing
          authToken={authToken}
          onLogout={handleLogout}
          onContinue={() => {
            setAuthReady(false);
            setBootstrapRefresh((current) => current + 1);
            setView('store_admin');
            window.history.replaceState({}, '', '/store');
          }}
        />
      </Suspense>
    );
  }

  if (view === 'home') {
    return (
      <Suspense fallback={<div className={styles.loading}>Loading...</div>}>
        <Homepage
          isAuthenticated
          accountActionLabel="Back to workspace"
          onNavigateLogin={goToAppLanding}
          onNavigateSignup={goToAppLanding}
        />
      </Suspense>
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

        {installPrompt && (
          <button
            type="button"
            className={styles.installBtn}
            onClick={async () => {
              if (!installPrompt) return;
              installPrompt.prompt();
              const { outcome } = await installPrompt.userChoice;
              if (outcome === 'accepted') {
                setInstallPrompt(null);
              }
            }}
          >
            Install Desktop App
          </button>
        )}

        <div className={styles.statusBox}>
          <div className={styles.statusLabel}>{bootstrap.user.role}</div>
          <div className={styles.statusValue}>{bootstrap.user.name}</div>
          <button className={styles.logoutBtn} type="button" onClick={handleLogout}>
            Sign out
          </button>
        </div>

        <div className={styles.builderCredit}>
          <span>System built by {BUILDER_NAME}</span>
          <a href={BUILDER_TEL_URL}>{BUILDER_PHONE_DISPLAY}</a>
          <a href={BUILDER_WHATSAPP_URL} target="_blank" rel="noreferrer">WhatsApp</a>
        </div>
      </aside>

      <main className={styles.main}>
        <ErrorBoundary>
          <Suspense fallback={<div className={styles.loading}>Loading...</div>}>
            {view === 'store_admin' && allowedIds.includes('store_admin') && (
              <StoreAdmin
                authToken={authToken}
                user={bootstrap.user}
                onOpenBilling={() => navigate({ id: 'billing', path: '/billing' })}
              />
            )}
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
          </Suspense>
        </ErrorBoundary>
      </main>

      {syncStatus.type !== 'idle' && (
        <div className={`${styles.syncIndicator} ${syncStatus.type === 'success' ? styles.syncSuccess : syncStatus.type === 'error' ? styles.syncError : ''}`}>
          {syncStatus.type === 'syncing' && <div className={styles.syncSpinner} />}
          <span>{syncStatus.message}</span>
        </div>
      )}
    </div>
  );
}
