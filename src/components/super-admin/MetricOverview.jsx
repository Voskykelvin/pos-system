import styles from '../SuperAdmin.module.css';
import { formatKes, formatPercent, formatUsd } from './formatters';

function metricValue(value, quiet = false) {
  return (
    <div className={`${styles.kpiValue} ${quiet ? styles.kpiTextValue : ''}`}>
      {value}
    </div>
  );
}

export default function MetricOverview({ metrics }) {
  const cards = [
    {
      label: 'MRR',
      value: metrics.mrrUsd > 0 ? formatUsd(metrics.mrrUsd) : 'No MRR yet',
      sub: metrics.mrrKes > 0 ? `${formatKes(metrics.mrrKes)} / mo` : 'Awaiting first active subscription',
      highlight: true,
      quiet: metrics.mrrUsd <= 0
    },
    {
      label: 'Active stores',
      value: metrics.activeTenants > 0 ? metrics.activeTenants : 'None active',
      sub: `${metrics.totalTenants || 0} total registered`,
      quiet: metrics.activeTenants <= 0
    },
    {
      label: 'Signup to active',
      value: metrics.totalTenants > 0 ? formatPercent(metrics.signupToActiveConversionRate) : 'No signups yet',
      sub: `${metrics.newTenants || 0} new in this range`,
      quiet: metrics.totalTenants <= 0
    },
    {
      label: 'Store activity',
      value: metrics.activeTenants > 0
        ? (metrics.activeStoresWithSales > 0 ? formatPercent(metrics.storeActivityRate) : 'No POS sales yet')
        : 'No active stores',
      sub: metrics.activeStoresWithSales > 0 ? `${metrics.activeStoresWithSales} stores sold` : 'Waiting for first sale signal',
      quiet: metrics.activeStoresWithSales <= 0
    },
    {
      label: 'ARPA',
      value: metrics.activeTenants > 0 ? formatUsd(metrics.arpaUsd) : 'No ARPA yet',
      sub: 'Average revenue per account',
      quiet: metrics.activeTenants <= 0
    },
    {
      label: 'Payment review',
      value: metrics.pendingSubscriptionPayments > 0 ? metrics.pendingSubscriptionPayments : 'Clear',
      sub: metrics.pendingPaymentTenants > 0 ? `${metrics.pendingPaymentTenants} unpaid tenants` : 'No pending references',
      quiet: metrics.pendingSubscriptionPayments <= 0
    },
    {
      label: 'Ending soon',
      value: metrics.expiringSoonTenants > 0 ? metrics.expiringSoonTenants : 'None',
      sub: 'Subscriptions within 7 days',
      quiet: metrics.expiringSoonTenants <= 0
    }
  ];

  return (
    <div className={styles.kpiGrid}>
      {cards.map((card) => (
        <article
          className={`${styles.kpiCard} ${card.highlight ? styles.highlightKpi : ''} ${card.quiet ? styles.quietKpi : ''}`}
          key={card.label}
        >
          <div className={styles.kpiLabel}>{card.label}</div>
          {metricValue(card.value, card.quiet)}
          <div className={styles.kpiSub}>{card.sub}</div>
        </article>
      ))}
    </div>
  );
}
