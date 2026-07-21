import { useEffect, useMemo, useState } from 'react';
import {
  Area,
  AreaChart,
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

const RANGE_OPTIONS = [
  { label: '7 days', value: 7 },
  { label: '30 days', value: 30 },
  { label: '90 days', value: 90 }
];

const CHART_COLORS = ['#059669', '#2563eb', '#d97706', '#dc2626', '#7c3aed', '#0f766e'];

function formatKes(amount) {
  return `KES ${Number(amount || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`;
}

function compactKes(amount) {
  const value = Number(amount || 0);
  if (Math.abs(value) >= 1000000) return `KES ${(value / 1000000).toFixed(1)}M`;
  if (Math.abs(value) >= 1000) return `KES ${(value / 1000).toFixed(0)}K`;
  return `KES ${value.toFixed(0)}`;
}

function formatNumber(value) {
  return Number(value || 0).toLocaleString(undefined, {
    maximumFractionDigits: 2
  });
}

function formatPercent(value) {
  return `${Number(value || 0).toFixed(1)}%`;
}

function getUrgencyLabel(urgency) {
  return String(urgency || 'watch').replace(/_/g, ' ');
}

export default function Analytics({ authToken }) {
  const [days, setDays] = useState(30);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [live, setLive] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);

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
      setLastUpdated(new Date());
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load(days);
  }, [authToken, days]);

  useEffect(() => {
    if (!live) return undefined;
    const timer = window.setInterval(() => load(days), 30000);
    return () => window.clearInterval(timer);
  }, [authToken, days, live]);

  const conversionCards = useMemo(() => {
    if (!data) return [];
    return [
      {
        label: 'Paid-order conversion',
        value: formatPercent(data.conversion?.paidOrderConversionRate),
        meta: `${data.conversion?.paidOrders || 0}/${data.conversion?.attemptedOrders || 0} attempts`
      },
      {
        label: 'Customer capture',
        value: formatPercent(data.conversion?.customerCaptureRate),
        meta: `${data.conversion?.capturedCustomerOrders || 0} linked receipts`
      },
      {
        label: 'Repeat customers',
        value: formatPercent(data.conversion?.repeatCustomerRate),
        meta: `${data.conversion?.repeatCustomers || 0} returning buyers`
      },
      {
        label: 'Stockout rate',
        value: formatPercent(data.summary?.stockoutRate),
        meta: `${data.summary?.outOfStockCount || 0} out of stock`
      }
    ];
  }, [data]);

  async function downloadCsv(e) {
    e.preventDefault();
    const res = await fetch(`/api/reports/export?days=${days}`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pos_export_${days}d_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  }

  if (error && !data) {
    return (
      <section className="analytics-page page-container">
        <div className="errorPanel" role="alert">
          <strong>Analytics could not refresh</strong>
          <span>{error}</span>
          <button type="button" onClick={() => load()}>Try again</button>
        </div>
      </section>
    );
  }

  return (
    <section className="analytics-page page-container">
      <header className="header">
        <div>
          <h1 className="title">Analytics</h1>
          <p className="subtitle">
            Sales trends, conversion, stock exposure, and replenishment signals.
          </p>
        </div>
        <div className="actions">
          <button
            className={`${"liveBtn"} ${live ? "liveActive" : ''}`}
            type="button"
            aria-pressed={live}
            onClick={() => setLive((value) => !value)}
          >
            <span className="liveDot" /> {live ? 'Live · 30s' : 'Live off'}
          </button>
          <a href={`/api/reports/export?days=${days}`} className="exportBtn" onClick={downloadCsv}>
            Export CSV
          </a>
          <div className="segmented">
            {RANGE_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                className={days === option.value ? "activeSegment" : ''}
                onClick={() => setDays(option.value)}
              >
                {option.label}
              </button>
            ))}
          </div>
          <button className="refreshBtn" onClick={() => load()} type="button">
            {loading ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
      </header>

      <div className="updateStrip" role="status" aria-live="polite">
        <span className={live ? "liveDot" : "pausedDot"} />
        {loading && data
          ? 'Refreshing live data…'
          : lastUpdated
            ? `Updated ${lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`
            : 'Preparing analytics'}
      </div>

      {error && data && (
        <div className="staleWarning" role="alert">
          Live refresh failed; showing the last successful snapshot. {error}
        </div>
      )}

      {!data ? (
        <div className="loading">Loading analytics...</div>
      ) : (
        <>
          <div className="metrics">
            <article className={`${"metric"} ${"salesMetric"}`}>
              <span>Gross sales</span>
              <strong>{formatKes(data.summary.grossSales)}</strong>
            </article>
            <article className={`${"metric"} ${"profitMetric"}`}>
              <span>Estimated profit</span>
              <strong>{formatKes(data.summary.estimatedGrossProfit)}</strong>
            </article>
            <article className={`${"metric"} ${"orderMetric"}`}>
              <span>Average order</span>
              <strong>{formatKes(data.summary.averageOrderValue)}</strong>
            </article>
            <article className={`${"metric"} ${"stockMetric"}`}>
              <span>Inventory at cost</span>
              <strong>{formatKes(data.summary.inventoryValueAtCost)}</strong>
            </article>
          </div>

          <div className="healthGrid">
            {conversionCards.map((card) => (
              <article className="healthCard" key={card.label}>
                <span>{card.label}</span>
                <strong>{card.value}</strong>
                <small>{card.meta}</small>
              </article>
            ))}
          </div>

          <div className="chartGrid">
            <section className={`${"panel"} ${"widePanel"}`}>
              <div className="panelHeader">
                <h2>Sales trend</h2>
                <span>{data.range.days} days</span>
              </div>
              <div className="chartFrame" role="img" aria-label="Sales and gross profit trend chart">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={data.salesTrend}>
                    <defs>
                      <linearGradient id="salesGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.42} />
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0.02} />
                      </linearGradient>
                      <linearGradient id="profitGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.01} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke="#e2e8f0" vertical={false} />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} minTickGap={24} />
                    <YAxis tickFormatter={compactKes} tick={{ fontSize: 11 }} width={72} />
                    <Tooltip formatter={(value, name) => [formatKes(value), name]} />
                    <Area type="monotone" dataKey="sales" name="Sales" stroke="#059669" fill="url(#salesGradient)" strokeWidth={3} activeDot={{ r: 5 }} />
                    <Area type="monotone" dataKey="grossProfit" name="Profit" stroke="#2563eb" fill="url(#profitGradient)" strokeWidth={2} activeDot={{ r: 4 }} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </section>

            <section className="panel">
              <div className="panelHeader">
                <h2>Conversion trend</h2>
                <span>Paid attempts</span>
              </div>
              <div className="chartFrame" role="img" aria-label="Order conversion trend chart">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={data.salesTrend}>
                    <CartesianGrid stroke="#e2e8f0" vertical={false} />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} minTickGap={24} />
                    <YAxis tickFormatter={(value) => `${value}%`} tick={{ fontSize: 11 }} width={48} />
                    <Tooltip formatter={(value) => [formatPercent(value), 'Conversion']} />
                    <Line type="monotone" dataKey="paidOrderConversionRate" stroke="#d97706" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </section>

            <section className="panel">
              <div className="panelHeader">
                <h2>Payment mix</h2>
                <span>{data.paymentMixChart.length} methods</span>
              </div>
              <div className="chartFrame" role="img" aria-label="Payment method mix chart">
                {data.paymentMixChart.length === 0 ? (
                  <p className="empty">No confirmed payments in this range.</p>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={data.paymentMixChart}
                        dataKey="amount"
                        nameKey="method"
                        innerRadius={54}
                        outerRadius={88}
                        paddingAngle={2}
                      >
                        {data.paymentMixChart.map((entry, index) => (
                          <Cell key={entry.method} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value, name) => [formatKes(value), name]} />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>
              {data.paymentMixChart.length > 0 && (
                <div className="chartLegend">
                  {data.paymentMixChart.map((entry, index) => (
                    <div key={entry.method}>
                      <i style={{ background: CHART_COLORS[index % CHART_COLORS.length] }} />
                      <span>{entry.method.replace(/_/g, ' ')}</span>
                      <strong>{formatPercent(entry.share)}</strong>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="panel">
              <div className="panelHeader">
                <h2>Category performance</h2>
                <span>{data.categorySales.length} categories</span>
              </div>
              <div className="chartFrame" role="img" aria-label="Sales by product category chart">
                {data.categorySales.length === 0 ? (
                  <p className="empty">No category sales yet.</p>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data.categorySales.slice(0, 8)} layout="vertical">
                      <CartesianGrid stroke="#e2e8f0" horizontal={false} />
                      <XAxis type="number" tickFormatter={compactKes} tick={{ fontSize: 11 }} />
                      <YAxis dataKey="category" type="category" tick={{ fontSize: 11 }} width={94} />
                      <Tooltip formatter={(value) => [formatKes(value), 'Sales']} />
                      <Bar dataKey="revenue" fill="#2563eb" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </section>

            <section className="panel">
              <div className="panelHeader">
                <h2>Stock recommendations</h2>
                <span>{data.stockRecommendations.length} actions</span>
              </div>
              {data.stockRecommendations.length === 0 ? (
                <p className="empty">No urgent restock action in this range.</p>
              ) : (
                <div className="recommendationList">
                  {data.stockRecommendations.map((product) => (
                    <div className="recommendationRow" key={product.productId}>
                      <div>
                        <div className="rowTitle">
                          <strong>{product.name}</strong>
                          <span className={`urgency ${product.urgency}`}>
                            {getUrgencyLabel(product.urgency)}
                          </span>
                        </div>
                        <span>
                          {formatNumber(product.currentStock)} {product.unit} on hand, sells {formatNumber(product.dailyVelocity)} {product.unit}/day
                        </span>
                        <small>{product.recommendation}</small>
                      </div>
                      <b>
                        Order {formatNumber(product.suggestedReorderQty)} {product.unit}
                      </b>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="panel">
              <div className="panelHeader">
                <h2>Staff performance</h2>
                <span>{data.staffPerformance.length} staff</span>
              </div>
              {data.staffPerformance.length === 0 ? (
                <p className="empty">No staff sales in this range.</p>
              ) : (
                <table className="table">
                  <thead>
                    <tr>
                      <th>Staff</th>
                      <th>Orders</th>
                      <th>Sales</th>
                      <th>Conversion</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.staffPerformance.map((staff) => (
                      <tr key={staff.id}>
                        <td>
                          <strong>{staff.name}</strong>
                          <span>{staff.role}</span>
                        </td>
                        <td>{staff.orders}</td>
                        <td>{formatKes(staff.sales)}</td>
                        <td>{formatPercent(staff.conversionRate)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </section>
          </div>

          <div className="grid">
            <section className="panel">
              <div className="panelHeader">
                <h2>Best sellers</h2>
                <span>Top {data.bestSellers.length}</span>
              </div>
              {data.bestSellers.length === 0 ? (
                <p className="empty">No paid sales in this range.</p>
              ) : (
                <table className="table">
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
                        <td>{formatPercent(product.sellThroughRate)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </section>

            <section className="panel">
              <div className="panelHeader">
                <h2>Slow movers</h2>
                <span>{data.slowMovers.length}</span>
              </div>
              {data.slowMovers.length === 0 ? (
                <p className="empty">Every stocked product sold in this range.</p>
              ) : (
                <div className="list">
                  {data.slowMovers.map((product) => (
                    <div className="listRow" key={product.id}>
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

          <p className="note">{data.notes.join(' ')}</p>
        </>
      )}
    </section>
  );
}
