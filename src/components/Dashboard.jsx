import { useEffect, useState } from 'react';

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

      <div className="metrics">
        <article className="metric">
          <span className="metricLabel">Revenue</span>
          <strong>{formatKes(report.revenue)}</strong>
        </article>
        <article className="metric">
          <span className="metricLabel">Orders</span>
          <strong>{report.orderCount}</strong>
        </article>
        <article className="metric">
          <span className="metricLabel">Average order</span>
          <strong>{formatKes(report.averageOrderValue)}</strong>
        </article>
        <article className="metric">
          <span className="metricLabel">Queued eTIMS</span>
          <strong>{report.pendingEtimsCount}</strong>
        </article>
      </div>

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

        <section className="panel">
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
