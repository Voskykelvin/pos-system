
const RANGE_OPTIONS = [
  { label: '30 days', value: 30 },
  { label: '90 days', value: 90 },
  { label: '365 days', value: 365 }
];

const SECTION_COPY = {
  dashboard: {
    title: 'Good morning, platform owner',
    text: 'See store health, revenue signals, and the work that needs your attention.'
  },
  analytics: {
    title: 'Platform analytics',
    text: 'Read acquisition, activation, revenue, and store activity trends in one place.'
  },
  plans: {
    title: 'Plans that scale with every store',
    text: 'Review the value, pricing, and included capabilities for each subscription tier.'
  },
  approvals: {
    title: 'Approvals queue',
    text: 'Verify submitted references, resolve account risk, and keep subscriptions current.'
  },
  users: {
    title: 'Access & roles',
    text: 'Create and review platform and store account access. Existing account changes remain in Store Setup.'
  },
  tenants: {
    title: 'Store directory',
    text: 'Review every store account, its subscription state, and the people responsible for it.'
  }
};

export default function PlatformHeader({ days, loading, metrics, section, onDaysChange, onRefresh }) {
  const copy = SECTION_COPY[section] || SECTION_COPY.dashboard;

  return (
    <header className="header">
      <div className="headerCopy">
        <span className="badge">Platform owner</span>
        <h1 className="title">{copy.title}</h1>
        <p>{copy.text}</p>
        <div className="headerMeta">
          <span>{metrics.totalTenants || 0} stores on platform</span>
          <span>Last {days} days</span>
        </div>
      </div>
      <div className="actions">
        <div className="segmented" aria-label="Date range">
          {RANGE_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              className={days === option.value ? "activeSegment" : ''}
              onClick={() => onDaysChange(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>
        <button className="refreshBtn" onClick={onRefresh} type="button">
          {loading ? 'Refreshing…' : 'Refresh data'}
        </button>
      </div>
    </header>
  );
}
