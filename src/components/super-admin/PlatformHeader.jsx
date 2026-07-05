import styles from '../SuperAdmin.module.css';

const RANGE_OPTIONS = [
  { label: '30 days', value: 30 },
  { label: '90 days', value: 90 },
  { label: '365 days', value: 365 }
];

export default function PlatformHeader({ days, loading, metrics, onDaysChange, onRefresh }) {
  return (
    <header className={styles.header}>
      <div className={styles.headerCopy}>
        <span className={styles.badge}>Platform owner</span>
        <h1 className={styles.title}>Platform Dashboard</h1>
        <p>Subscription reviews, tenant health, and store activity in one clean view.</p>
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
