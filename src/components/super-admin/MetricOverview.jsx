import { formatKes, formatPercent, formatUsd } from './formatters';

export default function MetricOverview({ metrics }) {
  const attention = [
    {
      label: 'Payment review',
      value: metrics.pendingSubscriptionPayments > 0 ? metrics.pendingSubscriptionPayments : 'Clear',
      tone: metrics.pendingSubscriptionPayments > 0 ? 'warn' : 'ok'
    },
    {
      label: 'Ending soon',
      value: metrics.expiringSoonTenants > 0 ? metrics.expiringSoonTenants : 'None',
      tone: metrics.expiringSoonTenants > 0 ? 'warn' : 'ok'
    },
    {
      label: 'Store activity',
      value: metrics.activeStoresWithSales > 0
        ? formatPercent(metrics.storeActivityRate)
        : 'Waiting',
      tone: metrics.activeStoresWithSales > 0 ? 'ok' : 'quiet'
    }
  ];

  const hero = [
    {
      label: 'MRR',
      value: metrics.mrrUsd > 0 ? formatUsd(metrics.mrrUsd) : '—',
      sub: metrics.mrrKes > 0 ? `${formatKes(metrics.mrrKes)} / mo` : 'No active subscriptions',
      accent: true
    },
    {
      label: 'Active stores',
      value: metrics.activeTenants || 0,
      sub: `${metrics.totalTenants || 0} registered`
    },
    {
      label: 'Conversion',
      value: metrics.totalTenants > 0 ? formatPercent(metrics.signupToActiveConversionRate) : '—',
      sub: `${metrics.newTenants || 0} new this range`
    },
    {
      label: 'ARPA',
      value: metrics.activeTenants > 0 ? formatUsd(metrics.arpaUsd) : '—',
      sub: 'Avg revenue / account'
    }
  ];

  return (
    <div className="overviewStack">
      <div className="kpiGrid kpiGridCompact">
        {hero.map((card) => (
          <article
            className={`kpiCard ${card.accent ? 'highlightKpi' : ''}`}
            key={card.label}
          >
            <div className="kpiLabel">{card.label}</div>
            <div className="kpiValue">{card.value}</div>
            <div className="kpiSub">{card.sub}</div>
          </article>
        ))}
      </div>

      <div className="attentionRail" aria-label="Attention items">
        {attention.map((item) => (
          <div className={`attentionChip tone-${item.tone}`} key={item.label}>
            <span>{item.label}</span>
            <strong>{item.value}</strong>
          </div>
        ))}
      </div>
    </div>
  );
}
