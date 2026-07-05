import styles from '../SuperAdmin.module.css';

const RANGE_OPTIONS = [
  { label: '30 days', value: 30 },
  { label: '90 days', value: 90 },
  { label: '365 days', value: 365 }
];

const SECTION_COPY = {
  overview: {
    title: 'Platform Overview',
    text: 'A quick read of subscriptions, active stores, and work waiting for review.'
  },
  analytics: {
    title: 'Platform Analytics',
    text: 'Signup trends, tenant sales signal, plan economics, and store health.'
  },
  plans: {
    title: 'Plans & Packaging',
    text: 'Review the tiers customers see during signup and billing.'
  },
  subscriptions: {
    title: 'Subscriptions & Payments',
    text: 'Follow renewals, pending references, rejected payments, and expiring accounts.'
  },
  tenants: {
    title: 'Users & Stores',
    text: 'Manage registered tenant profiles, owners, status, plans, and unused accounts.'
  }
};

export default function PlatformHeader({ days, loading, metrics, section, onDaysChange, onRefresh }) {
  const copy = SECTION_COPY[section] || SECTION_COPY.overview;

  return (
    <header className={styles.header}>
      <div className={styles.headerCopy}>
        <span className={styles.badge}>Platform owner</span>
        <h1 className={styles.title}>{copy.title}</h1>
        <p>{copy.text}</p>
        <div className={styles.headerMeta}>
          <span>{metrics.totalTenants || 'No'} registered stores</span>
          <span>{days}-day view</span>
        </div>
      </div>
      <div className={styles.actions}>
        <div className={styles.segmented} aria-label="Date range">
          {RANGE_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              className={days === option.value ? styles.activeSegment : ''}
              onClick={() => onDaysChange(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>
        <button className={styles.refreshBtn} onClick={onRefresh} type="button">
          {loading ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>
    </header>
  );
}
