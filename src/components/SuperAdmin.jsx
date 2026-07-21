'use client';

import { useEffect, useState } from 'react';
import MetricOverview from './super-admin/MetricOverview.jsx';
import PlanPackaging from './super-admin/PlanPackaging.jsx';
import PlatformCharts from './super-admin/PlatformCharts.jsx';
import PlatformHeader from './super-admin/PlatformHeader.jsx';
import SubscriptionPanels from './super-admin/SubscriptionPanels.jsx';
import TenantTable from './super-admin/TenantTable.jsx';

const SECTIONS = [
  { id: 'overview', label: 'Overview', path: '/super-admin/overview' },
  { id: 'analytics', label: 'Analytics', path: '/super-admin/analytics' },
  { id: 'plans', label: 'Plans', path: '/super-admin/plans' },
  { id: 'subscriptions', label: 'Subscriptions', path: '/super-admin/subscriptions' },
  { id: 'tenants', label: 'Users & Stores', path: '/super-admin/tenants' }
];

function sectionFromPath(pathname = window.location.pathname) {
  const match = SECTIONS.find((section) => pathname === section.path);
  return match?.id || 'overview';
}

export default function SuperAdmin({ authToken }) {
  const [days, setDays] = useState(30);
  const [section, setSection] = useState(sectionFromPath);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const onPop = () => setSection(sectionFromPath());
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  useEffect(() => {
    loadDashboard(days);
  }, [authToken, days]);

  function navigateSection(nextSection) {
    const item = SECTIONS.find((entry) => entry.id === nextSection);
    if (!item) return;
    setSection(item.id);
    if (window.location.pathname !== item.path) {
      window.history.pushState({}, '', item.path);
    }
  }

  async function loadDashboard(nextDays = days) {
    try {
      setLoading(true);
      const res = await fetch(`/api/super-admin/dashboard?days=${nextDays}`, {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Failed to load platform analytics');
      setData(result);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function updateTenant(tenant, updates) {
    try {
      const res = await fetch(`/api/super-admin/tenants/${tenant.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
        body: JSON.stringify(updates)
      });
      const result = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(result.error || 'Failed to update tenant');
      await loadDashboard(days);
    } catch (err) {
      alert(err.message);
    }
  }

  async function handleToggleStatus(tenant) {
    const status = tenant.status === 'active' ? 'suspended' : 'active';
    await updateTenant(tenant, { status });
  }

  async function reviewPayment(payment, action) {
    const adminNotes = action === 'reject'
      ? window.prompt('Reason for rejecting this payment reference?', 'Reference could not be verified.') || ''
      : '';

    try {
      const res = await fetch(`/api/billing/payments/${payment.id}/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({ adminNotes })
      });
      const result = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(result.error || `Failed to ${action} payment`);
      await loadDashboard(days);
    } catch (err) {
      alert(err.message);
    }
  }

  async function deleteTenantProfile(tenant) {
    const ok = window.confirm(
      `Delete unused tenant profile "${tenant.name}"?\n\nThis only succeeds if the store has no orders, customers, shifts, subscription payments, inventory movement, or other business activity.`
    );
    if (!ok) return;

    try {
      const res = await fetch(`/api/super-admin/tenants/${tenant.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${authToken}` }
      });
      const result = await res.json().catch(() => ({}));
      if (!res.ok) {
        const detail = result.blockers
          ? `\n\nBlockers: ${Object.entries(result.blockers)
            .filter(([, value]) => Number(value || 0) > 0)
            .map(([key, value]) => `${key}: ${value}`)
            .join(', ')}`
          : '';
        throw new Error(`${result.error || 'Tenant profile could not be deleted'}${detail}`);
      }
      await loadDashboard(days);
    } catch (err) {
      alert(err.message);
    }
  }

  if (loading && !data) return <div className="loading">Loading platform dashboard...</div>;
  if (error) return <div className="errorBanner">{error}</div>;

  const {
    metrics = {},
    tenants = [],
    charts = {},
    plans = [],
    subscriptionAlerts = [],
    subscriptionPayments = {},
    range = { days }
  } = data || {};
  const pendingReview = subscriptionPayments.pendingReview || [];

  return (
    <section className="container">
      <PlatformHeader
        days={days}
        loading={loading}
        metrics={metrics}
        section={section}
        onDaysChange={setDays}
        onRefresh={() => loadDashboard(days)}
      />

      <nav className="sectionNav" aria-label="Super admin sections">
        {SECTIONS.map((item) => (
          <button
            key={item.id}
            type="button"
            className={section === item.id ? "activeSection" : ''}
            onClick={() => navigateSection(item.id)}
          >
            {item.label}
          </button>
        ))}
      </nav>

      {section === 'overview' && (
        <>
          <MetricOverview metrics={metrics} />
          <SubscriptionPanels
            alerts={subscriptionAlerts}
            pendingReview={pendingReview}
            onReviewPayment={reviewPayment}
          />
        </>
      )}

      {section === 'analytics' && (
        <PlatformCharts charts={charts} metrics={metrics} rangeDays={range.days} />
      )}

      {section === 'plans' && (
        <PlanPackaging plans={plans} />
      )}

      {section === 'subscriptions' && (
        <SubscriptionPanels
          alerts={subscriptionAlerts}
          pendingReview={pendingReview}
          onReviewPayment={reviewPayment}
        />
      )}

      {section === 'tenants' && (
        <TenantTable
          tenants={tenants}
          plans={plans}
          onToggleStatus={handleToggleStatus}
          onUpdateTenant={updateTenant}
          onDeleteTenant={deleteTenantProfile}
        />
      )}
    </section>
  );
}
