'use client';

import { useState, useEffect } from 'react';
import styles from './SuperAdmin.module.css';

export default function SuperAdmin({ authToken }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadDashboard();
  }, [authToken]);

  async function loadDashboard() {
    try {
      setLoading(true);
      const res = await fetch('/api/super-admin/dashboard', {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Failed to load platform analytics');
      setData(result);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleToggleStatus(tenant) {
    const newStatus = tenant.status === 'active' ? 'suspended' : 'active';
    try {
      const res = await fetch(`/api/super-admin/tenants/${tenant.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({ status: newStatus })
      });
      if (!res.ok) throw new Error('Failed to update tenant status');
      await loadDashboard();
    } catch (err) {
      alert(err.message);
    }
  }

  if (loading) return <div className={styles.loading}>Loading SaaS Platform Analytics...</div>;
  if (error) return <div className={styles.errorBanner}>{error}</div>;

  const { metrics, tenants } = data;

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <span className={styles.badge}>SaaS Owner Master Control</span>
          <h1 className={styles.title}>Global Platform Dashboard</h1>
        </div>
        <button className={styles.refreshBtn} onClick={loadDashboard}>🔄 Refresh Data</button>
      </div>

      {/* Analytics KPI Cards */}
      <div className={styles.kpiGrid}>
        <div className={styles.kpiCard}>
          <div className={styles.kpiLabel}>Monthly Recurring Revenue (MRR)</div>
          <div className={styles.kpiValue}>${metrics.mrrUsd.toLocaleString()}</div>
          <div className={styles.kpiSub}>~ KES {metrics.mrrKes.toLocaleString()} / mo</div>
        </div>

        <div className={styles.kpiCard}>
          <div className={styles.kpiLabel}>Total Registered Stores</div>
          <div className={styles.kpiValue}>{metrics.totalTenants}</div>
          <div className={styles.kpiSub}>{metrics.activeTenants} active subscribers</div>
        </div>

        <div className={styles.kpiCard}>
          <div className={styles.kpiLabel}>Starter Plan ($29/mo)</div>
          <div className={styles.kpiValue}>{metrics.planBreakdown.starter} stores</div>
        </div>

        <div className={styles.kpiCard}>
          <div className={styles.kpiLabel}>Growth Plan ($79/mo)</div>
          <div className={styles.kpiValue}>{metrics.planBreakdown.growth} stores</div>
        </div>

        <div className={styles.kpiCard}>
          <div className={styles.kpiLabel}>Enterprise Plan ($199/mo)</div>
          <div className={styles.kpiValue}>{metrics.planBreakdown.enterprise} stores</div>
        </div>
      </div>

      {/* Stores Data Table */}
      <div className={styles.sectionHeader}>
        <h2>Registered Business Tenants</h2>
      </div>

      <table className={styles.table}>
        <thead>
          <tr>
            <th>Business Name</th>
            <th>Owner Email</th>
            <th>Currency</th>
            <th>Plan</th>
            <th>Joined Date</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {tenants.map((t) => (
            <tr key={t.id}>
              <td className={styles.tenantName}>{t.name}</td>
              <td>{t.owner?.email || '—'}</td>
              <td>{t.currency}</td>
              <td>
                <span className={`${styles.planBadge} ${styles[t.plan]}`}>{t.plan.toUpperCase()}</span>
              </td>
              <td>{new Date(t.createdAt).toLocaleDateString()}</td>
              <td>
                <span className={`${styles.statusBadge} ${styles[t.status]}`}>{t.status.toUpperCase()}</span>
              </td>
              <td>
                <button
                  className={t.status === 'active' ? styles.suspendBtn : styles.activateBtn}
                  onClick={() => handleToggleStatus(t)}
                >
                  {t.status === 'active' ? 'Suspend Store' : 'Activate Store'}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
