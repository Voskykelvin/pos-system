import { useEffect, useState } from 'react';
import styles from './Analytics.module.css';

function formatKes(amount) {
  return `KES ${Number(amount || 0).toFixed(2)}`;
}

function formatNumber(value) {
  return Number(value || 0).toLocaleString(undefined, {
    maximumFractionDigits: 2
  });
}

const RANGE_OPTIONS = [
  { label: '7 days', value: 7 },
  { label: '30 days', value: 30 },
  { label: '90 days', value: 90 }
];

export default function Analytics({ authToken }) {
  const [days, setDays] = useState(30);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  async function load(nextDays = days) {
    setLoading(true);
    try {
      const response = await fetch(`/api/reports/analytics?days=${nextDays}`, {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'Analytics failed');
      setData(payload);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load(days);
  }, [authToken, days]);

  if (error) {
    return (
      <section className={styles.page}>
        <div className={styles.errorPanel}>{error}</div>
      </section>
    );
  }

  return (
    <section className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>Analytics</h1>
          <p className={styles.subtitle}>
            Sales movement, stock exposure, and replenishment signals.
          </p>
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
          <button className={styles.refreshBtn} onClick={() => load()} type="button">
            {loading ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
      </header>

      {!data ? (
        <div className={styles.loading}>Loading analytics...</div>
      ) : (
        <>
          <div className={styles.metrics}>
            <article className={styles.metric}>
              <span>Gross sales</span>
              <strong>{formatKes(data.summary.grossSales)}</strong>
            </article>
            <article className={styles.metric}>
              <span>Estimated profit</span>
              <strong>{formatKes(data.summary.estimatedGrossProfit)}</strong>
            </article>
            <article className={styles.metric}>
              <span>Units sold</span>
              <strong>{formatNumber(data.summary.unitsSold)}</strong>
            </article>
            <article className={styles.metric}>
              <span>Stock at cost</span>
              <strong>{formatKes(data.summary.inventoryValueAtCost)}</strong>
            </article>
          </div>

          <div className={styles.healthGrid}>
            <article className={styles.healthCard}>
              <span>Low stock</span>
              <strong>{data.summary.lowStockCount}</strong>
            </article>
            <article className={styles.healthCard}>
              <span>Out of stock</span>
              <strong>{data.summary.outOfStockCount}</strong>
            </article>
            <article className={styles.healthCard}>
              <span>Avg order</span>
              <strong>{formatKes(data.summary.averageOrderValue)}</strong>
            </article>
            <article className={styles.healthCard}>
              <span>eTIMS queued</span>
              <strong>{data.summary.pendingEtimsCount}</strong>
            </article>
          </div>

          <div className={styles.grid}>
            <section className={styles.panel}>
              <div className={styles.panelHeader}>
                <h2>Best sellers</h2>
                <span>Top {data.bestSellers.length}</span>
              </div>
              {data.bestSellers.length === 0 ? (
                <p className={styles.empty}>No paid sales in this range.</p>
              ) : (
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Product</th>
                      <th>Units</th>
                      <th>Sales</th>
                      <th>Sell-through</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.bestSellers.map((product) => (
                      <tr key={product.id}>
                        <td>
                          <strong>{product.name}</strong>
                          <span>{product.sku || product.category}</span>
                        </td>
                        <td>{formatNumber(product.unitsSold)}</td>
                        <td>{formatKes(product.revenue)}</td>
                        <td>{product.sellThroughRate}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </section>

            <section className={styles.panel}>
              <div className={styles.panelHeader}>
                <h2>Category sales</h2>
                <span>{data.categorySales.length}</span>
              </div>
              {data.categorySales.length === 0 ? (
                <p className={styles.empty}>No category sales yet.</p>
              ) : (
                <div className={styles.list}>
                  {data.categorySales.map((category) => (
                    <div className={styles.listRow} key={category.category}>
                      <div>
                        <strong>{category.category}</strong>
                        <span>{formatNumber(category.unitsSold)} units</span>
                      </div>
                      <b>{formatKes(category.revenue)}</b>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className={styles.panel}>
              <div className={styles.panelHeader}>
                <h2>Stock alerts</h2>
                <span>{data.summary.lowStockCount + data.summary.outOfStockCount}</span>
              </div>
              {[...data.stockAlerts.outOfStock, ...data.stockAlerts.lowStock].length === 0 ? (
                <p className={styles.empty}>No urgent stock alerts.</p>
              ) : (
                <div className={styles.list}>
                  {[...data.stockAlerts.outOfStock, ...data.stockAlerts.lowStock].map((product) => (
                    <div className={styles.listRow} key={product.id}>
                      <div>
                        <strong>{product.name}</strong>
                        <span>{product.category} - reorder at {product.reorderLevel}</span>
                      </div>
                      <b>
                        {product.stockQuantity ?? 0} {product.unit}
                      </b>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className={styles.panel}>
              <div className={styles.panelHeader}>
                <h2>Slow movers</h2>
                <span>{data.slowMovers.length}</span>
              </div>
              {data.slowMovers.length === 0 ? (
                <p className={styles.empty}>Every stocked product sold in this range.</p>
              ) : (
                <div className={styles.list}>
                  {data.slowMovers.map((product) => (
                    <div className={styles.listRow} key={product.id}>
                      <div>
                        <strong>{product.name}</strong>
                        <span>{product.stockQuantity} {product.unit} on hand</span>
                      </div>
                      <b>{formatKes(product.inventoryRetailValue)}</b>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>

          <p className={styles.note}>{data.notes.join(' ')}</p>
        </>
      )}
    </section>
  );
}
