'use client';

import { useEffect, useState } from 'react';
import MetricOverview from './super-admin/MetricOverview.jsx';
import PlanPackaging from './super-admin/PlanPackaging.jsx';
import PlatformCharts from './super-admin/PlatformCharts.jsx';
import PlatformHeader from './super-admin/PlatformHeader.jsx';
import PlatformUsersPanel from './super-admin/PlatformUsersPanel.jsx';
import SubscriptionPanels from './super-admin/SubscriptionPanels.jsx';
import TenantTable from './super-admin/TenantTable.jsx';

const SECTIONS = [
  { id: 'dashboard', label: 'Dashboard', detail: 'Platform health at a glance', path: '/super-admin' },
  { id: 'analytics', label: 'Analytics', detail: 'Revenue and signup trends', path: '/super-admin/analytics' },
  { id: 'approvals', label: 'Approvals', detail: 'Verify payments and renewals', path: '/super-admin/approvals' },
  { id: 'plans', label: 'Plans', detail: 'Subscription packaging', path: '/super-admin/plans' },
  { id: 'users', label: 'Access & roles', detail: 'Platform access and roles', path: '/super-admin/users' },
  { id: 'tenants', label: 'Stores', detail: 'Accounts and plan status', path: '/super-admin/tenants' }
];

function sectionFromPath(pathname = window.location.pathname) {
  const legacySections = { '/super-admin/overview': 'dashboard', '/super-admin/subscriptions': 'approvals' };
  if (legacySections[pathname]) return legacySections[pathname];
  const match = SECTIONS.find((section) => pathname === section.path);
  return match?.id || 'dashboard';
}

export default function SuperAdmin({ authToken }) {
  const [days, setDays] = useState(30);
  const [section, setSection] = useState(sectionFromPath);
  const [data, setData] = useState(null);
  const [platformUsers, setPlatformUsers] = useState([]);
  const [userDraft, setUserDraft] = useState({
    name: '',
    email: '',
    phone: '',
    role: 'admin',
    tenantId: '',
    password: ''
  });
  const [userSaving, setUserSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const onPop = () => setSection(sectionFromPath());
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  useEffect(() => {
    loadDashboard(days);
    loadPlatformUsers();
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

  async function loadPlatformUsers() {
    try {
      const res = await fetch('/api/super-admin/users', {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      const result = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(result.error || 'Failed to load platform users');
      setPlatformUsers(Array.isArray(result.users) ? result.users : []);
    } catch (err) {
      setError(err.message);
    }
  }

  async function createPlatformUser(event) {
    event.preventDefault();
    try {
      setUserSaving(true);
      const payload = {
        ...userDraft,
        email: userDraft.email.trim(),
        phone: userDraft.phone.trim(),
        name: userDraft.name.trim(),
        tenantId: userDraft.tenantId || null,
        branchId: null
      };

      const res = await fetch('/api/super-admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
        body: JSON.stringify(payload)
      });
      const result = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(result.error || 'Failed to create user');

      setUserDraft({ name: '', email: '', phone: '', role: 'admin', tenantId: '', password: '' });
      await loadPlatformUsers();
      await loadDashboard(days);
    } catch (err) {
      alert(err.message);
    } finally {
      setUserSaving(false);
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

  function openApprovals() {
    const path = '/super-admin/approvals';
    if (window.location.pathname !== path) window.history.pushState({}, '', path);
    setSection('approvals');
  }

  async function reviewPayment(payment, action) {
    if (action === 'confirm' && payment.upgrade && payment.tenant?.plan === payment.upgrade.targetPlan) {
      const proceed = window.confirm(
        `The ${payment.upgrade.targetPlan} plan is already selected for this store. Confirm the verified payment and activate the subscription?`
      );
      if (!proceed) return;
    }
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
    subscriptionPayments = {}
  } = data || {};
  const pendingReview = subscriptionPayments.pendingReview || [];

  return (
    <section className="superAdminPage">
      <main className="platformMain">
        <PlatformHeader
          days={days}
          loading={loading}
          metrics={metrics}
          section={section}
          onDaysChange={setDays}
          onRefresh={() => loadDashboard(days)}
        />

        {section === 'dashboard' && <MetricOverview metrics={metrics} />}

        {section === 'analytics' && <PlatformCharts charts={charts} metrics={metrics} rangeDays={days} />}

        {section === 'approvals' && (
          <SubscriptionPanels
            alerts={subscriptionAlerts}
            pendingReview={pendingReview}
            onReviewPayment={reviewPayment}
          />
        )}

        {section === 'plans' && <PlanPackaging plans={plans} />}

        {section === 'users' && (
          <PlatformUsersPanel
            users={platformUsers}
            tenants={tenants}
            form={userDraft}
            onChange={setUserDraft}
            onCreate={createPlatformUser}
            saving={userSaving}
          />
        )}

        {section === 'tenants' && (
          <TenantTable
            tenants={tenants}
            plans={plans}
            onToggleStatus={handleToggleStatus}
            onUpdateTenant={updateTenant}
            onDeleteTenant={deleteTenantProfile}
            onOpenApprovals={openApprovals}
          />
        )}
      </main>
    </section>
  );
}
