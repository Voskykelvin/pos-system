import { useEffect, useState } from 'react';
import heroImage from '../assets/jijenge-pos-hero.jpg';
import {
  BUILDER_NAME,
  BUILDER_PHONE_DISPLAY,
  BUILDER_TEL_URL,
  BUILDER_WHATSAPP_URL
} from '../utils/builderContact';

const coreCapabilities = [
  {
    title: 'Counter Checkout',
    badge: 'Fast & Flexible',
    text: 'Move queues fast with barcode scanning, cart totals, split payments (Cash, M-Pesa), held sales, and instant digital receipts.'
  },
  {
    title: 'Inventory Control',
    badge: 'Real-time Stock',
    text: 'Keep products, categories, suppliers, purchase orders, stock corrections, and low-stock alerts organized in one place.'
  },
  {
    title: 'Reports & Analytics',
    badge: 'Live Insights',
    text: 'Track daily sales performance, payment mix breakdowns, profit margins, staff activity, and export clean financial reports.'
  },
  {
    title: 'Customer Credit & Loyalty',
    badge: 'Repeat Buyers',
    text: 'Manage customer credit limits, repayment ledgers, loyalty points, and customer purchase histories effortlessly.'
  }
];

const fallbackPlans = [
  {
    id: 'starter',
    name: 'Starter',
    priceUsd: 20,
    registerLimit: 1,
    branchLimit: 1,
    staffLimit: 3,
    featureSummary: 'For a single shop that wants clean counter checkout, stock control, and daily totals.',
    features: ['Counter checkout & split payments', 'Product catalog & categories', 'Daily dashboard & CSV exports', 'Low-stock alerts']
  },
  {
    id: 'growth',
    name: 'Growth',
    priceUsd: 70,
    registerLimit: 5,
    branchLimit: 5,
    staffLimit: 15,
    featureSummary: 'For growing stores needing supplier orders, customer credit ledgers, and deeper reporting.',
    features: ['Everything in Starter', 'Purchase orders & suppliers', 'Customer credit & loyalty ledgers', 'Staff performance & shift audits']
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    priceUsd: 115,
    registerLimit: null,
    branchLimit: null,
    staffLimit: null,
    featureSummary: 'For multi-branch retail operations with custom permissions, unlimited registers, and priority support.',
    features: ['Everything in Growth', 'Unlimited registers & staff', 'Multi-branch centralized view', 'Priority rollout & support']
  }
];

function formatPlanPrice(plan) {
  if (!Number(plan.priceUsd)) return 'Custom';
  return `$${Number(plan.priceUsd).toFixed(0)}`;
}

function formatPlanLimits(plan) {
  const branches = plan.branchLimit ? `${plan.branchLimit} branch${plan.branchLimit === 1 ? '' : 'es'}` : 'Unlimited branches';
  const registers = plan.registerLimit ? `${plan.registerLimit} register${plan.registerLimit === 1 ? '' : 's'}` : 'Unlimited registers';
  const staff = plan.staffLimit ? `${plan.staffLimit} staff` : 'Unlimited staff';
  return `${branches} - ${registers} - ${staff}`;
}

export default function Homepage({
  isAuthenticated = false,
  accountActionLabel = 'Sign in',
  onNavigateLogin,
  onNavigateSignup
}) {
  const [plans, setPlans] = useState(fallbackPlans);

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
        // Keeps page useful in static preview
      }
    }

    loadPlans();
    return () => {
      active = false;
    };
  }, []);

  const featuredPlan = plans.find((plan) => plan.id === 'growth') || plans[1] || plans[0];
  const navCtaLabel = isAuthenticated ? 'Open workspace' : 'Get started';
  const primaryCtaLabel = isAuthenticated ? 'Open my workspace' : 'Create my store';
  const secondaryCtaLabel = isAuthenticated ? 'Back to workspace' : 'I already have an account';

  function startSignup(planId = 'starter') {
    onNavigateSignup(planId);
  }

  function scrollTo(id) {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--ink)', fontFamily: 'var(--font-sans)' }}>
      {/* Navigation Bar */}
      <header style={{
        position: 'absolute',
        top: 'var(--space-4)',
        left: 'var(--space-6)',
        right: 'var(--space-6)',
        zIndex: 100,
        background: 'rgba(0, 0, 0, 0.4)',
        backdropFilter: 'blur(12px)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        borderRadius: '9999px',
        padding: '0 var(--space-4) 0 var(--space-6)',
        height: '64px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
          <div style={{
            width: 38,
            height: 38,
            borderRadius: 'var(--radius-full)',
            background: 'var(--brand)',
            color: 'white',
            display: 'grid',
            placeItems: 'center',
            fontFamily: 'var(--font-heading)',
            fontWeight: 800,
            fontSize: '1.25rem',
          }}>J</div>
          <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: '1.2rem', letterSpacing: '-0.02em', color: 'white' }}>Jijenge POS</span>
        </div>

        {/* Center Nav */}
        <nav style={{ display: 'none' }} className="desktop-nav">
          <ul style={{ display: 'flex', gap: 'var(--space-6)', listStyle: 'none', margin: 0, padding: 0 }}>
            {[['Product', 'product'], ['Who we serve', 'who-we-serve'], ['Pricing', 'pricing'], ['About', 'about']].map(([label, id]) => (
              <li key={id}>
                <button
                  onClick={() => scrollTo(id)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'rgba(255, 255, 255, 0.85)',
                    fontSize: 'var(--text-sm)',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '4px 0',
                    transition: 'color 0.15s'
                  }}
                  onMouseEnter={e => e.currentTarget.style.color = 'white'}
                  onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.85)'}
                >
                  {label}
                </button>
              </li>
            ))}
          </ul>
        </nav>

        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
          <button
            onClick={() => startSignup(featuredPlan?.id || 'starter')}
            className="btn-primary"
            style={{ height: '40px', padding: '0 var(--space-5)', fontSize: 'var(--text-sm)', fontWeight: 700 }}
          >
            {navCtaLabel}
          </button>
          <button
            onClick={onNavigateLogin}
            className="btn-secondary"
            style={{ height: '40px', padding: '0 var(--space-4)', fontSize: 'var(--text-sm)', fontWeight: 600, background: 'transparent', color: 'white', borderColor: 'rgba(255, 255, 255, 0.3)' }}
          >
            {accountActionLabel}
          </button>
        </div>
      </header>

      {/* Hero Section */}
      <section style={{
        position: 'relative',
        padding: 'var(--space-20) var(--space-6) var(--space-16)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        minHeight: '75vh',
        overflow: 'hidden'
      }}>
        <img
          src={heroImage}
          alt="Jijenge POS Store Counter"
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', zIndex: 0 }}
        />
        <div style={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(180deg, rgba(6, 32, 21, 0.92) 0%, rgba(6, 32, 21, 0.82) 100%)',
          zIndex: 1
        }} />

        <div style={{ position: 'relative', zIndex: 2, maxWidth: '820px', width: '100%', margin: '0 auto', color: 'white' }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 'var(--space-2)',
            padding: 'var(--space-1) var(--space-4)',
            borderRadius: '999px',
            background: 'rgba(16, 185, 129, 0.15)',
            border: '1px solid rgba(16, 185, 129, 0.3)',
            color: 'var(--brand-light)',
            fontSize: 'var(--text-xs)',
            fontWeight: 700,
            letterSpacing: '0.05em',
            textTransform: 'uppercase',
            marginBottom: 'var(--space-6)'
          }}>
            <span>Complete Store Operating System</span>
          </div>

          <h1 style={{
            fontFamily: 'var(--font-heading)',
            fontSize: 'clamp(2.5rem, 5.5vw, 4.25rem)',
            fontWeight: 800,
            lineHeight: 1.15,
            letterSpacing: '-0.03em',
            color: '#ffffff',
            marginBottom: 'var(--space-6)',
            textShadow: '0 2px 20px rgba(0,0,0,0.3)'
          }}>
            Run your shop without guessing.
          </h1>

          <p style={{
            fontSize: 'clamp(1.1rem, 2vw, 1.35rem)',
            color: 'rgba(255, 255, 255, 0.88)',
            marginBottom: 'var(--space-8)',
            lineHeight: 1.6,
            maxWidth: '680px',
            marginInline: 'auto'
          }}>
            Sell fast at the counter, track stock in real time, manage staff access, handle customer credit, and see your daily numbers clearly.
          </p>

          <div style={{ display: 'flex', gap: 'var(--space-4)', justifyContent: 'center', flexWrap: 'wrap', marginBottom: 'var(--space-8)' }}>
            <button
              onClick={() => startSignup(featuredPlan?.id || 'starter')}
              className="btn-primary"
              style={{
                height: '54px',
                padding: '0 var(--space-8)',
                fontSize: 'var(--text-base)',
                fontWeight: 700,
                borderRadius: 'var(--radius-md)',
                boxShadow: '0 8px 24px rgba(5, 150, 105, 0.4)'
              }}
            >
              {primaryCtaLabel}
            </button>
            <button
              onClick={onNavigateLogin}
              className="btn-secondary"
              style={{
                height: '54px',
                padding: '0 var(--space-8)',
                fontSize: 'var(--text-base)',
                fontWeight: 600,
                borderRadius: 'var(--radius-md)',
                background: 'rgba(255, 255, 255, 0.12)',
                color: '#ffffff',
                border: '1px solid rgba(255, 255, 255, 0.25)',
                backdropFilter: 'blur(8px)'
              }}
            >
              {secondaryCtaLabel}
            </button>
          </div>

        </div>
      </section>

      {/* Core Capabilities - Clean 4-Card Layout */}
      <section id="product" style={{ maxWidth: '1200px', margin: '0 auto', padding: 'var(--space-16) var(--space-6)', scrollMarginTop: '80px' }}>
        <div style={{ textAlign: 'center', maxWidth: '640px', margin: '0 auto var(--space-12)' }}>
          <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: 'clamp(1.75rem, 3.5vw, 2.5rem)', fontWeight: 800, letterSpacing: '-0.02em', marginBottom: 'var(--space-3)' }}>
            Everything your business needs
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-lg)', lineHeight: 1.5 }}>
            Designed for mini-marts, dukas, hardware stores, and multi-branch retail across Kenya.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 'var(--space-6)' }}>
          {coreCapabilities.map((cap) => (
            <div
              key={cap.title}
              className="glass-panel"
              style={{
                padding: 'var(--space-6)',
                borderRadius: '16px',
                display: 'flex',
                flexDirection: 'column',
                gap: 'var(--space-3)',
                transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                background: 'var(--surface)',
                border: '1px solid var(--border)'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                <span style={{
                  fontSize: 'var(--text-xs)',
                  fontWeight: 700,
                  color: 'var(--brand)',
                  background: 'var(--brand-soft)',
                  padding: '2px 10px',
                  borderRadius: '999px'
                }}>
                  {cap.badge}
                </span>
              </div>
              <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: 'var(--text-xl)', fontWeight: 700, marginTop: 'var(--space-2)' }}>
                {cap.title}
              </h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-sm)', lineHeight: 1.6, margin: 0 }}>
                {cap.text}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Who We Serve */}
      <section id="who-we-serve" style={{ background: 'var(--surface-2)', borderTop: '1px solid var(--border)', padding: 'var(--space-16) var(--space-6)', scrollMarginTop: '80px' }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', maxWidth: '620px', margin: '0 auto var(--space-12)' }}>
            <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: 'clamp(1.75rem, 3.5vw, 2.5rem)', fontWeight: 800, letterSpacing: '-0.02em', marginBottom: 'var(--space-3)' }}>
              Built for Kenyan retail
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-lg)', lineHeight: 1.5 }}>
              From a single corner duka to a multi-branch minimart, Jijenge POS adapts to how you sell.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 'var(--space-5)' }}>
            {[
              { name: 'Mini-marts & Superettes', desc: 'Fast barcode checkout, M-Pesa split, and daily totals with cash reconciliation.' },
              { name: 'Hardware & Building Stores', desc: 'Manage bulk stock, track credit for contractors, and run low-stock alerts.' },
              { name: 'Pharmacies & Chemists', desc: 'Itemized receipts, controlled-stock tracking, and customer purchase history.' },
              { name: 'Multi-branch Retail', desc: 'Centralized dashboard, per-branch reports, and unified staff management.' },
              { name: 'Fashion & Boutique', desc: 'Manage variants (size, color), loyalty points, and customer credit accounts.' },
              { name: 'Wholesale Distributors', desc: 'Bulk purchase orders, supplier invoicing, and multi-tier pricing control.' }
            ].map(({ name, desc }) => (
              <div key={name} style={{
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: '14px',
                padding: 'var(--space-5)',
                transition: 'box-shadow 0.2s, transform 0.2s'
              }}
              onMouseEnter={e => { e.currentTarget.style.boxShadow = 'var(--shadow-md)'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
              onMouseLeave={e => { e.currentTarget.style.boxShadow = ''; e.currentTarget.style.transform = ''; }}
              >
                <h3 style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 'var(--text-base)', marginBottom: 'var(--space-2)' }}>{name}</h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-sm)', lineHeight: 1.55, margin: 0 }}>{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Plans */}
      <section id="pricing" style={{ background: '#ffffff', borderTop: '1px solid var(--border)', padding: 'var(--space-16) var(--space-6)', scrollMarginTop: '80px' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', maxWidth: '600px', margin: '0 auto var(--space-12)' }}>
            <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: 'clamp(1.75rem, 3.5vw, 2.5rem)', fontWeight: 800, letterSpacing: '-0.02em', marginBottom: 'var(--space-3)' }}>
              Simple, transparent pricing
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-lg)' }}>
              Choose the plan that fits your store today and scale as you grow.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 'var(--space-6)' }}>
            {plans.map((plan) => {
              const isFeatured = plan.id === 'growth';
              return (
                <div
                  key={plan.id}
                  style={{
                    padding: 'var(--space-8) var(--space-6)',
                    borderRadius: '20px',
                    background: isFeatured ? 'linear-gradient(180deg, #f0fdf4 0%, #ffffff 100%)' : 'var(--surface)',
                    border: isFeatured ? '2px solid var(--brand)' : '1px solid var(--border)',
                    boxShadow: isFeatured ? '0 12px 32px rgba(16, 185, 129, 0.15)' : 'var(--shadow-sm)',
                    display: 'flex',
                    flexDirection: 'column',
                    position: 'relative'
                  }}
                >
                  {isFeatured && (
                    <div style={{
                      position: 'absolute',
                      top: '-14px',
                      left: '50%',
                      transform: 'translateX(-50%)',
                      background: 'var(--brand)',
                      color: 'white',
                      fontSize: 'var(--text-xs)',
                      fontWeight: 800,
                      padding: '4px 16px',
                      borderRadius: '999px',
                      letterSpacing: '0.05em',
                      textTransform: 'uppercase'
                    }}>
                      Most Popular
                    </div>
                  )}

                  <div style={{ marginBottom: 'var(--space-4)' }}>
                    <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: 'var(--text-2xl)', fontWeight: 800, marginBottom: 'var(--space-2)' }}>
                      {plan.name}
                    </h3>
                    <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-sm)', minHeight: '44px', lineHeight: 1.5 }}>
                      {plan.featureSummary}
                    </p>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 'var(--space-2)', marginBottom: 'var(--space-4)' }}>
                    <span style={{ fontSize: 'var(--text-4xl)', fontWeight: 800, fontFamily: 'var(--font-mono)', color: 'var(--ink)' }}>
                      {formatPlanPrice(plan)}
                    </span>
                    <span style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)' }}>/ month</span>
                  </div>

                  <div style={{
                    fontSize: 'var(--text-xs)',
                    fontWeight: 700,
                    color: 'var(--brand-dark)',
                    background: 'var(--brand-soft)',
                    padding: 'var(--space-2) var(--space-3)',
                    borderRadius: 'var(--radius-sm)',
                    marginBottom: 'var(--space-6)',
                    textAlign: 'center'
                  }}>
                    {formatPlanLimits(plan)}
                  </div>

                  <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 var(--space-8) 0', display: 'grid', gap: 'var(--space-3)', flex: 1 }}>
                    {plan.features.slice(0, 5).map((feature) => (
                      <li key={feature} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', fontSize: 'var(--text-sm)', color: 'var(--ink)' }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--brand)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                          <polyline points="20 6 9 17 4 12"></polyline>
                        </svg>
                        {feature}
                      </li>
                    ))}
                  </ul>

                  <button
                    onClick={() => startSignup(plan.id)}
                    className={isFeatured ? 'btn-primary' : 'btn-secondary'}
                    style={{ width: '100%', height: '48px', fontSize: 'var(--text-sm)', fontWeight: 700 }}
                  >
                    {isAuthenticated ? 'Open workspace' : `Start with ${plan.name}`}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* About + Footer - merged */}
      <footer id="about" style={{ background: 'var(--sidebar-bg)', color: 'white', scrollMarginTop: '80px' }}>

        {/* About body */}
        <div style={{ padding: 'var(--space-16) var(--space-6)', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          <div style={{ maxWidth: '800px', margin: '0 auto', textAlign: 'center' }}>
            <div style={{
              width: 56,
              height: 56,
              borderRadius: '50%',
              background: 'var(--brand)',
              display: 'grid',
              placeItems: 'center',
              fontFamily: 'var(--font-heading)',
              fontWeight: 800,
              fontSize: '1.5rem',
              margin: '0 auto var(--space-6)'
            }}>J</div>
            <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: 'clamp(1.75rem, 3.5vw, 2.25rem)', fontWeight: 800, marginBottom: 'var(--space-4)', letterSpacing: '-0.02em' }}>
              About Jijenge POS
            </h2>
            <p style={{ color: 'rgba(255,255,255,0.72)', fontSize: 'var(--text-lg)', lineHeight: 1.65, marginBottom: 'var(--space-10)', maxWidth: '600px', marginInline: 'auto' }}>
              Jijenge POS is a full retail management system built for Kenyan SME retailers.
              Counter checkout, stock control, M-Pesa payments, eTIMS VAT compliance, and staff management in one workspace.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 'var(--space-4)', maxWidth: '680px', margin: '0 auto' }}>
              {[
                { label: 'Counter Checkout', val: 'Barcode + M-Pesa' },
                { label: 'Inventory', val: 'Real-time stock' },
                { label: 'Compliance', val: 'eTIMS / KRA VAT' },
                { label: 'Staff Access', val: 'Role-based' }
              ].map(({ label, val }) => (
                <div key={label} style={{ padding: 'var(--space-4)', background: 'rgba(255,255,255,0.05)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.08)' }}>
                  <div style={{ color: 'var(--brand-light)', fontWeight: 700, fontSize: 'var(--text-sm)', marginBottom: '4px' }}>{val}</div>
                  <div style={{ color: 'rgba(255,255,255,0.45)', fontSize: 'var(--text-xs)' }}>{label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer bar */}
        <div style={{ padding: 'var(--space-8) var(--space-6)', textAlign: 'center' }}>
          <div style={{ maxWidth: '700px', margin: '0 auto', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--space-4)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
              <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--brand)', display: 'grid', placeItems: 'center', fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: '0.9rem' }}>J</div>
              <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: '1rem' }}>Jijenge POS</span>
            </div>
            <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 'var(--text-xs)', margin: 0 }}>
              Retail Point of Sale &amp; Store Management System built by {BUILDER_NAME}
            </p>
            <div style={{ display: 'flex', gap: 'var(--space-6)', fontSize: 'var(--text-sm)', flexWrap: 'wrap', justifyContent: 'center' }}>
              <a href={BUILDER_TEL_URL} style={{ color: 'var(--brand-light)', textDecoration: 'none', fontWeight: 600 }}>{BUILDER_PHONE_DISPLAY}</a>
              <a href={BUILDER_WHATSAPP_URL} target="_blank" rel="noreferrer" style={{ color: 'var(--brand-light)', textDecoration: 'none', fontWeight: 600 }}>WhatsApp</a>
            </div>
          </div>
        </div>

      </footer>
    </div>
  );
}
