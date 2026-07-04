import { useEffect, useMemo, useState } from 'react';
import heroImage from '../assets/jijenge-pos-hero.png';
import styles from './Homepage.module.css';

const fallbackScreens = [
  {
    path: '/checkout',
    name: 'Checkout',
    purpose: 'Sell fast with product search, cart totals, discounts, split payments, M-Pesa, cash, and customer credit.'
  },
  {
    path: '/inventory',
    name: 'Inventory',
    purpose: 'Keep products, categories, suppliers, purchase orders, stock adjustments, CSV tools, and barcode labels in one place.'
  },
  {
    path: '/operations',
    name: 'Operations',
    purpose: 'Open and close shifts, record expenses, reconcile cash, find receipts, approve refunds, and review audit logs.'
  },
  {
    path: '/analytics',
    name: 'Reports',
    purpose: 'See sales, payment mix, staff performance, stock health, export files, and reorder suggestions.'
  },
  {
    path: '/customers',
    name: 'Customers',
    purpose: 'Manage customer records, loyalty points, credit balances, ledgers, repayments, and repeat buyer history.'
  },
  {
    path: '/super-admin',
    name: 'Platform',
    purpose: 'Run many stores with tenant-aware accounts, owner signup, plan tiers, store health, and platform reporting.'
  }
];

const fallbackPlans = [
  {
    id: 'starter',
    name: 'Starter',
    priceUsd: 29,
    registerLimit: 1,
    staffLimit: 3,
    featureSummary: 'For a single shop that wants clean checkout, stock control, and daily numbers.',
    features: ['Checkout and split payments', 'Product catalog and categories', 'Daily dashboard and CSV export', 'Low-stock alerts']
  },
  {
    id: 'growth',
    name: 'Growth',
    priceUsd: 79,
    registerLimit: 5,
    staffLimit: 15,
    featureSummary: 'For a growing shop that needs purchasing, customer credit, loyalty, and deeper reporting.',
    features: ['Everything in Starter', 'Purchase orders and suppliers', 'Customer credit and loyalty', 'Staff and stock reports']
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    priceUsd: 199,
    registerLimit: null,
    staffLimit: null,
    featureSummary: 'For larger operators with many users, branches, audits, and rollout support.',
    features: ['Everything in Growth', 'Unlimited registers and staff', 'Multi-branch readiness', 'Priority support']
  }
];

const whoWeServe = [
  {
    title: 'Mini-marts and dukas',
    text: 'Move queues quickly, track fast-moving stock, and know what sold today.'
  },
  {
    title: 'Pharmacies and cosmetics shops',
    text: 'Keep item records tidy, watch low stock, and control staff refunds or adjustments.'
  },
  {
    title: 'Hardware and general retail',
    text: 'Handle many SKUs, supplier purchases, stock corrections, and credit customers.'
  },
  {
    title: 'Multi-branch stores',
    text: 'Give each store its own users and data while the owner sees the bigger picture.'
  }
];

const trustPoints = [
  'New owners can create a store account online',
  'Staff sign in only after they exist in the store',
  'Manager approval protects refunds and stock changes',
  'Each store sees its own data'
];

const setupSteps = [
  {
    title: 'Create the store',
    text: 'Use signup if you are the owner. Jijenge creates your store, your admin account, and starter categories.'
  },
  {
    title: 'Add the real shop data',
    text: 'Load products, suppliers, staff users, customers, promotions, and opening stock.'
  },
  {
    title: 'Connect live services',
    text: 'Add each shop’s M-Pesa, KRA eTIMS, SMS, domain, and production hosting credentials before going live.'
  }
];

function formatPlanPrice(plan) {
  if (!Number(plan.priceUsd)) return 'Custom';
  return `$${Number(plan.priceUsd).toFixed(0)}`;
}

function formatPlanLimits(plan) {
  const registers = plan.registerLimit ? `${plan.registerLimit} register${plan.registerLimit === 1 ? '' : 's'}` : 'Unlimited registers';
  const staff = plan.staffLimit ? `${plan.staffLimit} staff` : 'unlimited staff';
  return `${registers}, ${staff}`;
}

function screenIntro(screen) {
  const copy = {
    Dashboard: 'Today at a glance',
    Checkout: 'Sell at the counter',
    Inventory: 'Know what is in stock',
    Analytics: 'See what is working',
    Reports: 'See what is working',
    Customers: 'Keep buyers coming back',
    Operations: 'Control the daily routine',
    Platform: 'Run more than one store',
    'Platform SaaS': 'Run more than one store'
  };
  return copy[screen.name] || 'Part of the operating system';
}

export default function Homepage({ onNavigateLogin, onNavigateSignup }) {
  const [siteMap, setSiteMap] = useState(null);
  const [plans, setPlans] = useState(fallbackPlans);
  const [openMenu, setOpenMenu] = useState(null);

  useEffect(() => {
    let active = true;

    async function loadMasterData() {
      try {
        const [siteRes, planRes] = await Promise.all([
          fetch('/api/site-map'),
          fetch('/api/plans')
        ]);
        const [siteData, planData] = await Promise.all([
          siteRes.json(),
          planRes.json()
        ]);

        if (active && siteRes.ok) setSiteMap(siteData);
        if (active && planRes.ok && Array.isArray(planData.plans)) setPlans(planData.plans);
      } catch {
        // Keep the page useful even when the API is not reachable in a static preview.
      }
    }

    loadMasterData();
    return () => {
      active = false;
    };
  }, []);

  const featureScreens = useMemo(() => {
    const screens = siteMap?.screens?.length ? siteMap.screens : fallbackScreens;
    const normalized = screens
      .map((screen) => ({
        ...screen,
        name: screen.name === 'Dashboard' ? 'Dashboard' : screen.name,
        purpose: screen.purpose || fallbackScreens.find((item) => item.name === screen.name)?.purpose
      }))
      .filter((screen) => screen.path !== '/');

    const seen = new Set();
    return normalized.filter((screen) => {
      const key = screen.name === 'Platform SaaS' ? 'Platform' : screen.name;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [siteMap]);

  const featuredPlan = plans.find((plan) => plan.id === 'growth') || plans[1] || plans[0];

  function startSignup(planId = 'starter') {
    onNavigateSignup(planId);
  }

  function menuButton(id, label) {
    const expanded = openMenu === id;
    return (
      <button
        className={styles.menuButton}
        type="button"
        aria-expanded={expanded}
        onClick={() => setOpenMenu(expanded ? null : id)}
      >
        {label}
        <span aria-hidden="true">v</span>
      </button>
    );
  }

  return (
    <main className={styles.page}>
      <section className={styles.hero} id="top">
        <img className={styles.heroImage} src={heroImage} alt="" />
        <div className={styles.heroShade} />

        <nav className={styles.topbar} aria-label="Homepage">
          <a className={styles.brand} href="#top" aria-label="Jijenge POS home">
            <span className={styles.brandMark}>J</span>
            <span>Jijenge POS</span>
          </a>

          <div className={styles.menuBar} onMouseLeave={() => setOpenMenu(null)}>
            <div className={styles.menuItem}>
              {menuButton('product', 'Product')}
              {openMenu === 'product' && (
                <div className={styles.dropdown}>
                  <div className={styles.dropdownHeader}>
                    <strong>What the system runs</strong>
                    <span>Counter, stock, staff, reports, and customers.</span>
                  </div>
                  <div className={styles.dropdownGrid}>
                    {featureScreens.slice(0, 6).map((screen) => (
                      <a href="#features" key={screen.path}>
                        <strong>{screen.name === 'Platform SaaS' ? 'Platform' : screen.name}</strong>
                        <span>{screenIntro(screen)}</span>
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className={styles.menuItem}>
              {menuButton('serve', 'Who we serve')}
              {openMenu === 'serve' && (
                <div className={styles.dropdown}>
                  <div className={styles.dropdownHeader}>
                    <strong>Built for shops that sell stock every day</strong>
                    <span>Simple enough for one counter, structured enough for more branches.</span>
                  </div>
                  <div className={styles.dropdownGrid}>
                    {whoWeServe.map((item) => (
                      <a href="#who-we-serve" key={item.title}>
                        <strong>{item.title}</strong>
                        <span>{item.text}</span>
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className={styles.menuItem}>
              {menuButton('pricing', 'Pricing')}
              {openMenu === 'pricing' && (
                <div className={styles.dropdown}>
                  <div className={styles.dropdownHeader}>
                    <strong>Start small, upgrade when the store grows</strong>
                    <span>Plans come from the Jijenge backend catalog.</span>
                  </div>
                  <div className={styles.planMenuGrid}>
                    {plans.map((plan) => (
                      <button type="button" key={plan.id} onClick={() => startSignup(plan.id)}>
                        <span>{plan.name}</span>
                        <strong>{formatPlanPrice(plan)} / mo</strong>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className={styles.menuItem}>
              {menuButton('about', 'About')}
              {openMenu === 'about' && (
                <div className={styles.dropdown}>
                  <div className={styles.dropdownHeader}>
                    <strong>The process</strong>
                    <span>Signup creates the store. Login is for existing staff.</span>
                  </div>
                  <div className={styles.dropdownGrid}>
                    {setupSteps.map((step) => (
                      <a href="#setup" key={step.title}>
                        <strong>{step.title}</strong>
                        <span>{step.text}</span>
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <button className={styles.signInBtn} type="button" onClick={onNavigateLogin}>
              Sign in
            </button>
          </div>
        </nav>

        <div className={styles.heroContent}>
          <p className={styles.kicker}>POS, inventory, payments, and reports</p>
          <h1>Run your shop without guessing.</h1>
          <p className={styles.heroCopy}>
            Jijenge POS helps a shop owner sell at the counter, track stock, manage staff actions, handle customer credit, and see the day’s numbers clearly.
          </p>
          <div className={styles.heroActions}>
            <button className={styles.primaryBtn} type="button" onClick={() => startSignup(featuredPlan?.id || 'starter')}>
              Create my store
            </button>
            <button className={styles.secondaryBtn} type="button" onClick={onNavigateLogin}>
              I already have an account
            </button>
          </div>
          <p className={styles.loginNote}>
            New owner? Create a store. Staff member? Ask the owner or manager to add you, then sign in.
          </p>
        </div>
      </section>

      <section className={styles.proofBand} aria-label="Highlights">
        <div className={styles.proofGrid}>
          {trustPoints.map((point) => (
            <div className={styles.proofItem} key={point}>
              <span />
              <strong>{point}</strong>
            </div>
          ))}
        </div>
      </section>

      <section className={styles.featureSection} id="features">
        <div className={styles.sectionHeader}>
          <p>Product</p>
          <h2>The master frontend maps to the real app.</h2>
          <span>These are not brochure-only features. They point to the same modules staff use after login.</span>
        </div>

        <div className={styles.moduleGrid}>
          {featureScreens.map((screen) => (
            <article className={styles.moduleCard} key={screen.path}>
              <div className={styles.moduleEyebrow}>{screen.path}</div>
              <h3>{screen.name === 'Platform SaaS' ? 'Platform' : screen.name}</h3>
              <p>{screen.purpose}</p>
            </article>
          ))}
        </div>
      </section>

      <section className={styles.serveSection} id="who-we-serve">
        <div className={styles.sectionHeader}>
          <p>Who We Serve</p>
          <h2>Made for everyday retail, not office theory.</h2>
          <span>Jijenge fits shops where stock moves, cash must reconcile, and the owner wants fewer surprises.</span>
        </div>

        <div className={styles.serveGrid}>
          {whoWeServe.map((item) => (
            <article key={item.title}>
              <h3>{item.title}</h3>
              <p>{item.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className={styles.pricingSection} id="pricing">
        <div className={styles.sectionHeader}>
          <p>Pricing</p>
          <h2>Pick the plan that matches the shop today.</h2>
          <span>You can start with one register and move up when the team, branches, or reporting needs grow.</span>
        </div>

        <div className={styles.pricingGrid}>
          {plans.map((plan) => (
            <article className={`${styles.priceCard} ${plan.id === 'growth' ? styles.featuredPrice : ''}`} key={plan.id}>
              <div className={styles.priceTopline}>
                <h3>{plan.name}</h3>
                {plan.id === 'growth' && <span>Most shops</span>}
              </div>
              <div className={styles.price}>
                <strong>{formatPlanPrice(plan)}</strong>
                <span>/ month</span>
              </div>
              <p>{plan.featureSummary}</p>
              <div className={styles.limitText}>{formatPlanLimits(plan)}</div>
              <ul>
                {plan.features.slice(0, 5).map((feature) => (
                  <li key={feature}>{feature}</li>
                ))}
              </ul>
              <button type="button" onClick={() => startSignup(plan.id)}>
                Start with {plan.name}
              </button>
            </article>
          ))}
        </div>
      </section>

      <section className={styles.setupSection} id="setup">
        <div className={styles.sectionHeader}>
          <p>How It Works</p>
          <h2>Signup creates the store. Login runs the store.</h2>
        </div>
        <div className={styles.flowSteps}>
          {setupSteps.map((step, index) => (
            <article key={step.title}>
              <span>{String(index + 1).padStart(2, '0')}</span>
              <h3>{step.title}</h3>
              <p>{step.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className={styles.ctaSection}>
        <div>
          <p>Ready to try it?</p>
          <h2>Create a Jijenge store, then start from the actual operating dashboard.</h2>
        </div>
        <div className={styles.ctaActions}>
          <button className={styles.primaryBtn} type="button" onClick={() => startSignup(featuredPlan?.id || 'starter')}>
            Create my store
          </button>
          <button className={styles.secondaryDarkBtn} type="button" onClick={onNavigateLogin}>
            Sign in
          </button>
        </div>
      </section>
    </main>
  );
}
