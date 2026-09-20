import { useEffect, useState } from 'react';
import {
  buildDashboardActions,
  buildDashboardSummary,
  buildOperationalAlerts,
  formatCurrency
} from '../utils/dashboardUi';

function formatKes(amount) {
  return `KES ${Number(amount || 0).toFixed(2)}`;
}

function formatTime(value) {
  return new Intl.DateTimeFormat(undefined, {
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(value));
}

export default function Dashboard({ authToken }) {
  const [report, setReport] = useState(null);
  const [error, setError] = useState(null);

  async function load() {
    try {
      const reportRes = await fetch('/api/reports/today', {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      const reportData = await reportRes.json();

      if (!reportRes.ok) throw new Error(reportData.error || 'Report failed');
      setReport(reportData);
      setError(null);
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => {
    load();
  }, [authToken]);

  if (error) {
    return (
      <section className="dashboard-page page-container">
        <div className="errorPanel">{error}</div>
      </section>
    );
  }

  if (!report) {
    return (
      <section className="dashboard-page page-container">
        <div className="loading">Loading dashboard...</div>
      </section>
    );
  }

  const paymentEntries = Object.entries(report.paymentBreakdown || {});
  const summary = buildDashboardSummary(report);
  const actions = buildDashboardActions(report);
  const operationalAlerts = buildOperationalAlerts(report);

  return (
    <section className="dashboard-page page-container">
      <header className="header">
        <div>
          <h1 className="title">Daily dashboard</h1>
          <p className="date">{report.date}</p>
        </div>
        <button className="refreshBtn" onClick={load} type="button">
          Refresh
        </button>
      </header>

      <div className="statusSummary">
        <div className="statusSummaryMain">
          <span className="statusSummaryLabel">Operations status</span>
          <strong>{summary.status}</strong>
        </div>
        <div className="statusSummaryMeta">
          <span>{summary.focus}</span>
          <strong>{summary.highlight}</strong>
        </div>
      </div>

      <div className="metrics">
        <article className="metric metricRevenue">
          <span className="metricLabel">Revenue</span>
          <strong>{formatCurrency(summary.revenue)}</strong>
        </article>
        <article className="metric">
          <span className="metricLabel">Orders</span>
          <strong>{summary.orderCount}</strong>
        </article>
        <article className="metric">
          <span className="metricLabel">Average order</span>
          <strong>{summary.highlight === 'Average order pending' ? 'Pending' : formatCurrency(report.averageOrderValue)}</strong>
        </article>
        <article className="metric metricAttention">
          <span className="metricLabel">Queued eTIMS</span>
          <strong>{summary.pendingEtimsCount}</strong>
        </article>
      </div>

      <div className="actionPanel">
        <div className="panelHeader">
          <h2>Priority actions</h2>
        </div>
        <div className="actionList">
          {actions.map((action) => (
            <div className={`actionRow actionRow${action.priority}`} key={action.id}>
              <div>
                <strong>{action.label}</strong>
                <small>{action.detail}</small>
              </div>
              <span className="actionPriority">{action.priority}</span>
            </div>
          ))}
        </div>
      </div>

      {operationalAlerts.length > 0 && (
        <div className="actionPanel">
          <div className="panelHeader">
            <h2>Reorder alerts</h2>
          </div>
          <div className="actionList">
            {operationalAlerts.map((alert) => (
              <div className={`actionRow actionRow${alert.severity}`} key={alert.id}>
                <div>
                  <strong>{alert.label}</strong>
                  <small>{alert.message}</small>
                </div>
                <span className="actionPriority">{alert.severity}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid">
        <section className="panel">
          <div className="panelHeader">
            <h2>Payment mix</h2>
          </div>
          {paymentEntries.length === 0 ? (
            <p className="empty">No confirmed payments yet.</p>
          ) : (
            <div className="list">
              {paymentEntries.map(([method, amount]) => (
                <div className="listRow" key={method}>
                  <span className="capitalize">{method}</span>
                  <strong>{formatKes(amount)}</strong>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="panel">
          <div className="panelHeader">
            <h2>Low stock</h2>
            <span>{report.lowStock.length}</span>
          </div>
          {report.lowStock.length === 0 ? (
            <p className="empty">All tracked products are above reorder level.</p>
          ) : (
            <div className="list">
              {report.lowStock.map((product) => (
                <div className="listRow" key={product.id}>
                  <div>
                    <div className="itemName">{product.name}</div>
                    <div className="itemMeta">{product.sku}</div>
                  </div>
                  <strong>
                    {product.stockQuantity} {product.unit}
                  </strong>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="panel fullWidthPanel">
          <div className="panelHeader">
            <h2>Recent orders</h2>
          </div>
          {report.recentOrders.length === 0 ? (
            <p className="empty">No sales have been posted today.</p>
          ) : (
            <div className="list">
              {report.recentOrders.map((order) => (
                <div className="listRow" key={order.id}>
                  <div>
                    <div className="itemName">{order.orderNumber}</div>
                    <div className="itemMeta">
                      {formatTime(order.createdAt)} - {order.paymentStatus}
                    </div>
                  </div>
                  <strong>{formatKes(order.total)}</strong>
                </div>
              ))}
            </div>
          )}
        </section>

      </div>
    </section>
  );
}
