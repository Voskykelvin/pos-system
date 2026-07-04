'use client';

import { useEffect, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts';
import styles from './SuperAdmin.module.css';

const RANGE_OPTIONS = [
  { label: '30 days', value: 30 },
  { label: '90 days', value: 90 },
  { label: '365 days', value: 365 }
];

const PLAN_COLORS = {
  starter: '#2563eb',
  growth: '#059669',
  enterprise: '#7c3aed'
};

const HEALTH_COLORS = ['#059669', '#2563eb', '#d97706', '#dc2626', '#7c3aed'];

function formatUsd(amount) {
  return `$${Number(amount || 0).toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  })}`;
}

function formatKes(amount) {
  return `KES ${Number(amount || 0).toLocaleString(undefined, {
    maximumFractionDigits: 0
  })}`;
}

function compactKes(amount) {
  const value = Number(amount || 0);
  if (Math.abs(value) >= 1000000) return `KES ${(value / 1000000).toFixed(1)}M`;
  if (Math.abs(value) >= 1000) return `KES ${(value / 1000).toFixed(0)}K`;
  return `KES ${value.toFixed(0)}`;
}

function formatPercent(value) {
  return `${Number(value || 0).toFixed(1)}%`;
}

function labelize(value) {
  return String(value || '').replace(/_/g, ' ');
}

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

  if (loading && !data) return <div className={styles.loading}>Loading SaaS platform analytics...</div>;
  if (error) return <div className={styles.errorBanner}>{error}</div>;

  const { metrics, tenants, charts, plans } = data;

  return (
    <section className={styles.container}>
      <header className={styles.header}>
        <div>
          <span className={styles.badge}>SaaS owner master control</span>
          <h1 className={styles.title}>Global Platform Dashboard</h1>
        </div>
        <div className={styles.actions}>
          <div className={styles.segmented}>
            {RANGE_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                className={days === option.value ? styles.activeSegment : ''}
                onClick={() => setDays(option.value)}
              >
                {option.label}
              </button>
            ))}
          </div>
          <button className={styles.refreshBtn} onClick={() => loadDashboard()} type="button">
            {loading ? 'Refreshing...' : 'Refresh Data'}
          </button>
        </div>
      </header>

      <div className={styles.kpiGrid}>
        <article className={styles.kpiCard}>
          <div className={styles.kpiLabel}>Monthly recurring revenue</div>
          <div className={styles.kpiValue}>{formatUsd(metrics.mrrUsd)}</div>
          <div className={styles.kpiSub}>{formatKes(metrics.mrrKes)} / mo</div>
        </article>

        <article className={styles.kpiCard}>
          <div className={styles.kpiLabel}>Active stores</div>
          <div className={styles.kpiValue}>{metrics.activeTenants}</div>
          <div className={styles.kpiSub}>{metrics.totalTenants} total registered</div>
        </article>

        <article className={styles.kpiCard}>
          <div className={styles.kpiLabel}>Signup to active</div>
          <div className={styles.kpiValue}>{formatPercent(metrics.signupToActiveConversionRate)}</div>
          <div className={styles.kpiSub}>{metrics.newTenants} new in range</div>
        </article>

        <article className={styles.kpiCard}>
          <div className={styles.kpiLabel}>Store activity</div>
          <div className={styles.kpiValue}>{formatPercent(metrics.storeActivityRate)}</div>
          <div className={styles.kpiSub}>{metrics.activeStoresWithSales} active stores sold</div>
        </article>

        <article className={styles.kpiCard}>
          <div className={styles.kpiLabel}>ARPA</div>
          <div className={styles.kpiValue}>{formatUsd(metrics.arpaUsd)}</div>
          <div className={styles.kpiSub}>average revenue per account</div>
        </article>
      </div>

      <div className={styles.chartGrid}>
        <section className={styles.panel}>
          <div className={styles.panelHeader}>
            <h2>Store signups</h2>
            <span>{data.range.days} days</span>
          </div>
          <div className={styles.chartFrame}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={charts.signupTrend}>
                <CartesianGrid stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} minTickGap={24} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} width={38} />
                <Tooltip />
                <Line type="monotone" dataKey="signups" name="Signups" stroke="#2563eb" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="activated" name="Activated" stroke="#059669" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className={styles.panel}>
          <div className={styles.panelHeader}>
            <h2>Platform sales activity</h2>
            <span>Tenant POS volume</span>
          </div>
          <div className={styles.chartFrame}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={charts.signupTrend}>
                <CartesianGrid stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} minTickGap={24} />
                <YAxis yAxisId="left" tickFormatter={compactKes} tick={{ fontSize: 11 }} width={72} />
                <YAxis yAxisId="right" orientation="right" allowDecimals={false} tick={{ fontSize: 11 }} width={38} />
                <Tooltip formatter={(value, name) => (name === 'Revenue' ? [formatKes(value), name] : [value, name])} />
                <Line yAxisId="left" type="monotone" dataKey="revenue" name="Revenue" stroke="#059669" strokeWidth={2} dot={false} />
                <Line yAxisId="right" type="monotone" dataKey="paidOrders" name="Paid orders" stroke="#d97706" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className={styles.panel}>
          <div className={styles.panelHeader}>
            <h2>Plan economics</h2>
            <span>{formatUsd(metrics.mrrUsd)} MRR</span>
          </div>
          <div className={styles.chartFrame}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={charts.planMix}>
                <CartesianGrid stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tickFormatter={(value) => `$${value}`} tick={{ fontSize: 11 }} width={48} />
                <Tooltip formatter={(value) => [formatUsd(value), 'MRR']} />
                <Bar dataKey="mrrUsd" radius={[4, 4, 0, 0]}>
                  {charts.planMix.map((entry) => (
                    <Cell key={entry.plan} fill={PLAN_COLORS[entry.plan] || '#64748b'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className={styles.panel}>
          <div className={styles.panelHeader}>
            <h2>Tenant health</h2>
            <span>Risk view</span>
          </div>
          <div className={styles.chartFrame}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={charts.tenantHealth.filter((item) => item.stores > 0)}
                  dataKey="stores"
                  nameKey="health"
                  innerRadius={54}
                  outerRadius={88}
                  paddingAngle={2}
                >
                  {charts.tenantHealth.map((entry, index) => (
                    <Cell key={entry.health} fill={HEALTH_COLORS[index % HEALTH_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value, name) => [value, labelize(name)]} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>

      <section className={styles.panel}>
        <div className={styles.panelHeader}>
          <h2>Plan packaging</h2>
          <span>Current tiers</span>
        </div>
        <div className={styles.planGrid}>
          {plans.map((plan) => (
            <article className={styles.planCard} key={plan.id}>
              <div className={styles.planTopline}>
                <span className={`${styles.planBadge} ${styles[plan.id]}`}>{plan.name}</span>
                <strong>{formatUsd(plan.priceUsd)} / mo</strong>
              </div>
              <p>{plan.featureSummary}</p>
              <ul>
                {plan.features.map((feature) => (
                  <li key={feature}>{feature}</li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </section>

      <section className={styles.panel}>
        <div className={styles.panelHeader}>
          <h2>Registered business tenants</h2>
          <span>{tenants.length} stores</span>
        </div>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Business</th>
                <th>Owner</th>
                <th>Plan</th>
                <th>Activity</th>
                <th>Sales</th>
                <th>Health</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {tenants.map((tenant) => (
                <tr key={tenant.id}>
                  <td className={styles.tenantName}>
                    <strong>{tenant.name}</strong>
                    <span>{tenant.currency} - joined {new Date(tenant.createdAt).toLocaleDateString()}</span>
                  </td>
                  <td>{tenant.owner?.email || '-'}</td>
                  <td>
                    <select
                      className={styles.planSelect}
                      value={tenant.plan}
                      onChange={(event) => updateTenant(tenant, { plan: event.target.value })}
                    >
                      {plans.map((plan) => (
                        <option key={plan.id} value={plan.id}>{plan.name}</option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <strong>{tenant.activity.paidOrders}</strong>
                    <span>{formatPercent(tenant.activity.conversionRate)} conversion</span>
                  </td>
                  <td>{formatKes(tenant.activity.sales)}</td>
                  <td>
                    <span className={`${styles.healthBadge} ${styles[tenant.activity.health]}`}>
                      {labelize(tenant.activity.health)}
                    </span>
                    {tenant.activity.upgradeSignal && <small className={styles.upgradeHint}>Upgrade lead</small>}
                  </td>
                  <td>
                    <span className={`${styles.statusBadge} ${styles[tenant.status]}`}>{tenant.status}</span>
                  </td>
                  <td>
                    <button
                      className={tenant.status === 'active' ? styles.suspendBtn : styles.activateBtn}
                      onClick={() => handleToggleStatus(tenant)}
                      type="button"
                    >
                      {tenant.status === 'active' ? 'Suspend' : 'Activate'}
                    </button>
                  </td>
                </tr>
              ))}
              {tenants.length === 0 && (
                <tr>
                  <td colSpan="8" className={styles.emptyCell}>No tenant stores registered yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </section>
  );
}
