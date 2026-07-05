import {
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
import styles from '../SuperAdmin.module.css';
import {
  formatKes,
  formatUsd,
  hasAnyValue,
  labelize,
  nonZeroKesTick,
  nonZeroTick
} from './formatters';

const PLAN_COLORS = {
  starter: '#2563eb',
  growth: '#059669',
  enterprise: '#7c3aed'
};

const HEALTH_COLORS = ['#059669', '#2563eb', '#0f766e', '#d97706', '#f97316', '#dc2626', '#7c3aed'];

function EmptyChartState({ title, text }) {
  return (
    <div className={styles.emptyChart}>
      <strong>{title}</strong>
      <span>{text}</span>
    </div>
  );
}

function ChartPanel({ title, meta, children, hasData = true, emptyTitle, emptyText }) {
  return (
    <section className={styles.panel}>
      <div className={styles.panelHeader}>
        <h2>{title}</h2>
        <span>{meta}</span>
      </div>
      <div className={styles.chartFrame}>
        {hasData ? children : <EmptyChartState title={emptyTitle} text={emptyText} />}
      </div>
    </section>
  );
}

export default function PlatformCharts({ charts, metrics, rangeDays }) {
  const signupRows = charts.signupTrend || [];
  const planRows = charts.planMix || [];
  const healthRows = (charts.tenantHealth || []).filter((item) => item.stores > 0);
  const hasSignupSignal = hasAnyValue(signupRows, ['signups', 'activated']);
  const hasSalesSignal = hasAnyValue(signupRows, ['revenue', 'paidOrders']);
  const hasPlanSignal = hasAnyValue(planRows, ['mrrUsd', 'stores']);

  return (
    <div className={styles.chartGrid}>
      <ChartPanel
        title="Store signups"
        meta={`${rangeDays} days`}
        hasData={hasSignupSignal}
        emptyTitle="No new stores in this range"
        emptyText="New tenant signups and activations will appear here once the funnel starts moving."
      >
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={signupRows}>
            <CartesianGrid stroke="#e2e8f0" vertical={false} />
            <XAxis dataKey="date" tick={{ fontSize: 11 }} minTickGap={24} />
            <YAxis allowDecimals={false} tickFormatter={nonZeroTick} tick={{ fontSize: 11 }} width={38} />
            <Tooltip />
            <Line type="monotone" dataKey="signups" name="Signups" stroke="#2563eb" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="activated" name="Activated" stroke="#059669" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </ChartPanel>

      <ChartPanel
        title="POS sales signal"
        meta="Tenant sales volume"
        hasData={hasSalesSignal}
        emptyTitle="No tenant POS sales yet"
        emptyText="This stays quiet until an active store completes paid checkout orders."
      >
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={signupRows}>
            <CartesianGrid stroke="#e2e8f0" vertical={false} />
            <XAxis dataKey="date" tick={{ fontSize: 11 }} minTickGap={24} />
            <YAxis yAxisId="left" tickFormatter={nonZeroKesTick} tick={{ fontSize: 11 }} width={72} />
            <YAxis yAxisId="right" orientation="right" allowDecimals={false} tickFormatter={nonZeroTick} tick={{ fontSize: 11 }} width={38} />
            <Tooltip formatter={(value, name) => (name === 'Revenue' ? [formatKes(value), name] : [value, name])} />
            <Line yAxisId="left" type="monotone" dataKey="revenue" name="Revenue" stroke="#059669" strokeWidth={2} dot={false} />
            <Line yAxisId="right" type="monotone" dataKey="paidOrders" name="Paid orders" stroke="#d97706" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </ChartPanel>

      <ChartPanel
        title="Plan economics"
        meta={`${formatUsd(metrics.mrrUsd)} MRR`}
        hasData={hasPlanSignal}
        emptyTitle="No paid plan mix yet"
        emptyText="Confirmed subscriptions will show revenue split by tier here."
      >
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={planRows}>
            <CartesianGrid stroke="#e2e8f0" vertical={false} />
            <XAxis dataKey="name" tick={{ fontSize: 11 }} />
            <YAxis tickFormatter={(value) => (Number(value) === 0 ? '' : `$${value}`)} tick={{ fontSize: 11 }} width={48} />
            <Tooltip formatter={(value) => [formatUsd(value), 'MRR']} />
            <Bar dataKey="mrrUsd" radius={[4, 4, 0, 0]}>
              {planRows.map((entry) => (
                <Cell key={entry.plan} fill={PLAN_COLORS[entry.plan] || '#64748b'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </ChartPanel>

      <ChartPanel
        title="Tenant health"
        meta="Risk view"
        hasData={healthRows.length > 0}
        emptyTitle="No tenant health data yet"
        emptyText="Tenant risk states will appear after stores start onboarding."
      >
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={healthRows}
              dataKey="stores"
              nameKey="health"
              innerRadius={54}
              outerRadius={88}
              paddingAngle={2}
            >
              {healthRows.map((entry, index) => (
                <Cell key={entry.health} fill={HEALTH_COLORS[index % HEALTH_COLORS.length]} />
              ))}
            </Pie>
            <Tooltip formatter={(value, name) => [value, labelize(name)]} />
          </PieChart>
        </ResponsiveContainer>
        <div className={styles.healthLegend}>
          {healthRows.map((entry, index) => (
            <span key={entry.health}>
              <i style={{ background: HEALTH_COLORS[index % HEALTH_COLORS.length] }} />
              {labelize(entry.health)}: {entry.stores}
            </span>
          ))}
        </div>
      </ChartPanel>
    </div>
  );
}
