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
import { syncOfflineOrders } from './utils/offlineQueue';
import {
  BUILDER_NAME,
  BUILDER_PHONE_DISPLAY,
  BUILDER_TEL_URL,
  BUILDER_WHATSAPP_URL
} from './utils/builderContact';

/* -- Inline SVG Icons (no dependency) ------------------ */

const IconDashboard = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>
);
const IconCheckout = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="8" cy="21" r="1"/><circle cx="19" cy="21" r="1"/><path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12"/></svg>
);
const IconInventory = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m7.5 4.27 9 5.15"/><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/></svg>
);
const IconAnalytics = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v18h18"/><path d="m19 9-5 5-4-4-3 3"/></svg>
);
const IconCustomers = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
);
const IconOperations = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>
);
const IconStore = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m2 7 4.41-4.41A2 2 0 0 1 7.83 2h8.34a2 2 0 0 1 1.42.59L22 7"/><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><path d="M15 22v-4a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v4"/><path d="M2 7h20"/><path d="M22 7v3a2 2 0 0 1-2 2a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 16 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 12 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 8 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 4 12a2 2 0 0 1-2-2V7"/></svg>
);
const IconPlatform = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10"/></svg>
);
const IconSun = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/></svg>
);
const IconMoon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>
);
const IconMenu = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="4" x2="20" y1="12" y2="12"/><line x1="4" x2="20" y1="6" y2="6"/><line x1="4" x2="20" y1="18" y2="18"/></svg>
);
const IconX = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
);

const NAV_ICONS = {
  store_admin: IconStore,
  dashboard: IconDashboard,
  checkout: IconCheckout,
  inventory: IconInventory,
  analytics: IconAnalytics,
  customers: IconCustomers,
  operations: IconOperations,
  saas_owner: IconPlatform
};

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

function getInitialTheme() {
  const saved = localStorage.getItem('pos_theme');
  if (saved) return saved;
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export default function App() {
  const [view, setView] = useState(getInitialView);
  const [authMode, setAuthMode] = useState(getInitialAuthMode);
  const [authToken, setAuthToken] = useState(() => {
    const legacyToken = localStorage.getItem('pos_auth_token');
    localStorage.removeItem('pos_auth_token');
    return legacyToken;
  });
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
  const refreshAttemptedRef = useRef(false);

  // Theme state
  const [theme, setTheme] = useState(getInitialTheme);
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('pos_theme', theme);
  }, [theme]);

  // Mobile sidebar state
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const isMobile = () => window.matchMedia('(max-width: 900px)').matches;

  useEffect(() => {
    if (!mobileSidebarOpen || !isMobile()) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const handleKey = (e) => { if (e.key === 'Escape') setMobileSidebarOpen(false); };
    window.addEventListener('keydown', handleKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', handleKey);
    };
  }, [mobileSidebarOpen]);

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
        if (localStorage.getItem('pos_signed_out') === 'true' || refreshAttemptedRef.current) {
          setAuthReady(true);
          return;
        }
        refreshAttemptedRef.current = true;
        try {
          const refreshed = await fetch('/api/auth/refresh', { method: 'POST', credentials: 'same-origin' });
          if (refreshed.ok) {
            const payload = await refreshed.json();
            setAuthToken(payload.token);
            return;
          }
        } catch {
          // A visitor or offline device without a refresh session remains signed out.
        }
        setAuthReady(true);
        return;
      }

      try {
        let token = authToken;
        let res = await fetch('/api/bootstrap', {
          headers: { Authorization: `Bearer ${authToken}` }
        });
        if (res.status === 401) {
          const refreshed = await fetch('/api/auth/refresh', { method: 'POST', credentials: 'same-origin' });
          if (refreshed.ok) {
            const payload = await refreshed.json();
            token = payload.token;
            setAuthToken(token);
            res = await fetch('/api/bootstrap', { headers: { Authorization: `Bearer ${token}` } });
          }
        }
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
        const { synced, failed } = await syncOfflineOrders(authToken, {
          cashierId: bootstrap.cashierId,
          tenantId: bootstrap.user?.tenantId || null
        });
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
    const handleServiceWorkerMessage = (event) => {
      if (event.data?.type === 'OFFLINE_SYNC_REQUESTED') handleOnline();
    };
    navigator.serviceWorker?.addEventListener('message', handleServiceWorkerMessage);
    if (navigator.onLine) {
      handleOnline();
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      navigator.serviceWorker?.removeEventListener('message', handleServiceWorkerMessage);
      if (syncTimeoutRef.current) {
        window.clearTimeout(syncTimeoutRef.current);
        syncTimeoutRef.current = null;
      }
    };
  }, [authToken, bootstrap.cashierId, bootstrap.user?.tenantId]);

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
    if (isMobile()) setMobileSidebarOpen(false);
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

  async function handleLogout() {
    if (authToken) {
      try {
        await fetch('/api/auth/logout', {
          method: 'POST',
          headers: { Authorization: `Bearer ${authToken}` }
        });
      } catch {
        // Local logout must still complete if the network is unavailable.
      }
    }
    localStorage.removeItem('pos_auth_token');
    localStorage.setItem('pos_signed_out', 'true');
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
    return <div className="loading">Loading workspace...</div>;
  }

  if (authToken && !bootstrap.user) {
    return <div className="loading">Loading workspace...</div>;
  }

  if (authMode === 'signup' && !authToken) {
    return (
      <Suspense fallback={<div className="loading">Loading...</div>}>
        <Signup
          initialPlan={signupPlan}
          onSignupSuccess={(token, user, tenant) => {
            localStorage.removeItem('pos_signed_out');
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
      <Suspense fallback={<div className="loading">Loading...</div>}>
        <Login
          onLogin={(payload) => {
            const token = typeof payload === 'string' ? payload : payload.token;
            localStorage.removeItem('pos_signed_out');
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
      <Suspense fallback={<div className="loading">Loading...</div>}>
        <Homepage
          onNavigateLogin={goToLogin}
          onNavigateSignup={goToSignup}
        />
      </Suspense>
    );
  }

  if (view === 'billing') {
    return (
      <Suspense fallback={<div className="loading">Loading...</div>}>
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
      <Suspense fallback={<div className="loading">Loading...</div>}>
        <Homepage
          isAuthenticated
          accountActionLabel="Back to workspace"
          onNavigateLogin={goToAppLanding}
          onNavigateSignup={goToAppLanding}
        />
      </Suspense>
    );
  }

  const userInitial = bootstrap.user?.name?.[0]?.toUpperCase() || 'U';

  return (
    <div className="shell">
      <a className="skipLink" href="#main-content">Skip to main content</a>

      {/* Mobile Top Bar */}
      <div className="mobileTopBar">
        <button className="mobileMenuBtn" type="button" onClick={() => setMobileSidebarOpen(true)} aria-label="Open menu">
          <IconMenu />
        </button>
        <button className="brand" type="button" onClick={goToMasterHomepage} aria-label="Open master homepage">
          <span className="brandMark">J</span>
          <span className="brandName">Jijenge POS</span>
        </button>
        <div style={{ width: 40 }} />
      </div>

      {/* Sidebar Backdrop (mobile) */}
      {mobileSidebarOpen && (
        <button
          className="sidebarBackdrop"
          type="button"
          aria-label="Close navigation menu"
          onClick={() => setMobileSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`${"sidebar"} ${mobileSidebarOpen ? "sidebarOpen" : ''}`}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <button className="brand" type="button" onClick={goToMasterHomepage} aria-label="Open master homepage">
            <span className="brandMark">J</span>
            <div>
              <div className="brandName">Jijenge POS</div>
              <div className="brandMeta">{bootstrap.demoMode ? 'Sample workspace' : 'Live store'}</div>
            </div>
          </button>
          {/* Close button for mobile */}
          <button
            className={`${"mobileMenuBtn"} ${"mobileCloseBtn"}`}
            type="button"
            onClick={() => setMobileSidebarOpen(false)}
            aria-label="Close menu"
          >
            <IconX />
          </button>
        </div>

        <div className="navSection">
          <div className="navLabel">Menu</div>
          <nav className="nav" aria-label="Primary">
            {visibleNavItems.map((item) => {
              const Icon = NAV_ICONS[item.id];
              return (
                <button
                  key={item.id}
                  className={`${"navButton"} ${view === item.id ? "active" : ''}`}
                  onClick={() => navigate(item)}
                  type="button"
                >
                  {Icon && <Icon />}
                  {item.label}
                </button>
              );
            })}
          </nav>
        </div>

        {installPrompt && (
          <button
            type="button"
            className="installBtn"
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

        <div className="statusBox">
          <div className="userCard">
            <div className="userAvatar">{userInitial}</div>
            <div className="userInfo">
              <div className="userName">{bootstrap.user.name}</div>
              <div className="userRole">{bootstrap.user.role}</div>
            </div>
            <button
              className="themeToggle"
              type="button"
              onClick={() => setTheme((t) => t === 'light' ? 'dark' : 'light')}
              aria-label="Toggle dark mode"
            >
              {theme === 'dark' ? <IconSun /> : <IconMoon />}
            </button>
          </div>
          <button className="logoutBtn" type="button" onClick={handleLogout}>
            Sign out
          </button>
        </div>

        <div className="builderCredit">
          <span>System built by {BUILDER_NAME}</span>
          <a href={BUILDER_TEL_URL}>{BUILDER_PHONE_DISPLAY}</a>
          <a href={BUILDER_WHATSAPP_URL} target="_blank" rel="noreferrer">WhatsApp</a>
        </div>
      </aside>

      <main id="main-content" className="main">
        <ErrorBoundary>
          <Suspense fallback={<div className="loading">Loading...</div>}>
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
        <div className={`${"syncIndicator"} ${syncStatus.type === 'success' ? "syncSuccess" : syncStatus.type === 'error' ? "syncError" : ''}`}>
          {syncStatus.type === 'syncing' && <div className="syncSpinner" />}
          <span>{syncStatus.message}</span>
        </div>
      )}
    </div>
  );
}
