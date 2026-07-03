import { useEffect, useState } from 'react';
import styles from './Dashboard.module.css';

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
  const [siteMap, setSiteMap] = useState(null);
  const [error, setError] = useState(null);

  async function load() {
    try {
      const [reportRes, siteMapRes] = await Promise.all([
        fetch('/api/reports/today', {
          headers: { Authorization: `Bearer ${authToken}` }
        }),
        fetch('/api/site-map')
      ]);
      const [reportData, siteMapData] = await Promise.all([
        reportRes.json(),
        siteMapRes.json()
      ]);

      if (!reportRes.ok) throw new Error(reportData.error || 'Report failed');
      setReport(reportData);
      setSiteMap(siteMapData);
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
      <section className={styles.page}>
        <div className={styles.errorPanel}>{error}</div>
      </section>
    );
  }

  if (!report) {
    return (
      <section className={styles.page}>
        <div className={styles.loading}>Loading dashboard...</div>
      </section>
    );
  }

  const paymentEntries = Object.entries(report.paymentBreakdown || {});

  return (
    <section className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>Daily dashboard</h1>
          <p className={styles.date}>{report.date}</p>
        </div>
        <button className={styles.refreshBtn} onClick={load} type="button">
          Refresh
        </button>
      </header>

      <div className={styles.metrics}>
        <article className={styles.metric}>
          <span className={styles.metricLabel}>Revenue</span>
          <strong>{formatKes(report.revenue)}</strong>
        </article>
        <article className={styles.metric}>
          <span className={styles.metricLabel}>Orders</span>
          <strong>{report.orderCount}</strong>
        </article>
        <article className={styles.metric}>
          <span className={styles.metricLabel}>Average order</span>
          <strong>{formatKes(report.averageOrderValue)}</strong>
        </article>
        <article className={styles.metric}>
          <span className={styles.metricLabel}>Queued eTIMS</span>
          <strong>{report.pendingEtimsCount}</strong>
        </article>
      </div>

      <div className={styles.grid}>
        <section className={styles.panel}>
          <div className={styles.panelHeader}>
            <h2>Payment mix</h2>
          </div>
          {paymentEntries.length === 0 ? (
            <p className={styles.empty}>No confirmed payments yet.</p>
          ) : (
            <div className={styles.list}>
              {paymentEntries.map(([method, amount]) => (
                <div className={styles.listRow} key={method}>
                  <span className={styles.capitalize}>{method}</span>
                  <strong>{formatKes(amount)}</strong>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className={styles.panel}>
          <div className={styles.panelHeader}>
            <h2>Low stock</h2>
            <span>{report.lowStock.length}</span>
          </div>
          {report.lowStock.length === 0 ? (
            <p className={styles.empty}>All tracked products are above reorder level.</p>
          ) : (
            <div className={styles.list}>
              {report.lowStock.map((product) => (
                <div className={styles.listRow} key={product.id}>
                  <div>
                    <div className={styles.itemName}>{product.name}</div>
                    <div className={styles.itemMeta}>{product.sku}</div>
                  </div>
                  <strong>
                    {product.stockQuantity} {product.unit}
                  </strong>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className={styles.panel}>
          <div className={styles.panelHeader}>
            <h2>Recent orders</h2>
          </div>
          {report.recentOrders.length === 0 ? (
            <p className={styles.empty}>No sales have been posted today.</p>
          ) : (
            <div className={styles.list}>
              {report.recentOrders.map((order) => (
                <div className={styles.listRow} key={order.id}>
                  <div>
                    <div className={styles.itemName}>{order.orderNumber}</div>
                    <div className={styles.itemMeta}>
                      {formatTime(order.createdAt)} - {order.paymentStatus}
                    </div>
                  </div>
                  <strong>{formatKes(order.total)}</strong>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className={styles.panel}>
          <div className={styles.panelHeader}>
            <h2>Site map</h2>
            <span>{siteMap?.api?.length || 0} API</span>
          </div>
          <div className={styles.routeList}>
            {(siteMap?.screens || []).map((screen) => (
              <div className={styles.routeRow} key={screen.path}>
                <strong>{screen.path}</strong>
                <span>{screen.name}</span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </section>
  );
}
