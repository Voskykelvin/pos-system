'use client';

import { useEffect, useState } from 'react';
import styles from './SuperAdmin.module.css';
import MetricOverview from './super-admin/MetricOverview.jsx';
import PlanPackaging from './super-admin/PlanPackaging.jsx';
import PlatformCharts from './super-admin/PlatformCharts.jsx';
import PlatformHeader from './super-admin/PlatformHeader.jsx';
import SubscriptionPanels from './super-admin/SubscriptionPanels.jsx';
import TenantTable from './super-admin/TenantTable.jsx';

export default function SuperAdmin({ authToken }) {
  const [days, setDays] = useState(30);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadDashboard(days);
  }, [authToken, days]);

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

  if (loading && !data) return <div className={styles.loading}>Loading platform dashboard...</div>;
  if (error) return <div className={styles.errorBanner}>{error}</div>;

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
    <section className={styles.container}>
      <PlatformHeader
        days={days}
        loading={loading}
        metrics={metrics}
        onDaysChange={setDays}
        onRefresh={() => loadDashboard(days)}
      />
      <MetricOverview metrics={metrics} />
      <PlatformCharts charts={charts} metrics={metrics} rangeDays={range.days} />
      <SubscriptionPanels
        alerts={subscriptionAlerts}
        pendingReview={pendingReview}
        onReviewPayment={reviewPayment}
      />
      <PlanPackaging plans={plans} />
      <TenantTable
        tenants={tenants}
        plans={plans}
        onToggleStatus={handleToggleStatus}
        onUpdateTenant={updateTenant}
      />
    </section>
  );
}
