import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { formatKes, formatUsd, hasAnyValue, labelize } from './formatters';

const PLAN_COLORS = { starter: '#34d399', growth: '#38bdf8', enterprise: '#a78bfa' };
const HEALTH_COLORS = { healthy: '#10b981', new_store: '#38bdf8', expiring_soon: '#f59e0b', no_sales: '#fb7185', pending_payment: '#f97316', past_due: '#ef4444', suspended: '#64748b' };

function EmptyChart({ title, text }) {
  return <div className="analyticsEmpty"><strong>{title}</strong><span>{text}</span></div>;
}

function ChartCard({ title, subtitle, children, empty, className = '' }) {
  return <section className={`analyticsCard ${className}`}><div className="analyticsCardHeader"><div><h2>{title}</h2><p>{subtitle}</p></div></div><div className="analyticsChart">{empty || children}</div></section>;
}

function shortDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function ValueTooltip({ active, payload, label, money = false }) {
  if (!active || !payload?.length) return null;
  return <div className="analyticsTooltip"><strong>{shortDate(label)}</strong>{payload.map((entry) => <span key={entry.dataKey}><i style={{ background: entry.color }} />{entry.name}: {money ? formatKes(entry.value) : entry.value}</span>)}</div>;
}

export default function PlatformCharts({ charts, metrics, rangeDays }) {
  const signupRows = charts.signupTrend || [];
  const planRows = charts.planMix || [];
  const healthRows = (charts.tenantHealth || []).filter((row) => row.stores > 0);
  const signupData = signupRows.filter((_, index) => rangeDays <= 31 || index % Math.ceil(rangeDays / 30) === 0 || index === signupRows.length - 1);
  const hasSignupData = hasAnyValue(signupRows, ['signups', 'activated']);
  const hasRevenueData = hasAnyValue(signupRows, ['revenue', 'paidOrders']);
  const hasPlanData = hasAnyValue(planRows, ['stores']);

  return (
    <div className="analyticsGrid">
      <ChartCard title="Acquisition & activation" subtitle={`${rangeDays}-day view · New stores versus activated accounts`} className="analyticsWide" empty={!hasSignupData && <EmptyChart title="The story starts with your first store" text="New account creation and activation will appear here as soon as they happen." />}>
        <ResponsiveContainer width="100%" height="100%"><BarChart data={signupData} margin={{ top: 8, right: 8, left: -20, bottom: 0 }} barGap={4}><CartesianGrid vertical={false} stroke="#e8edf0" /><XAxis dataKey="date" tickFormatter={shortDate} tick={{ fill: '#6b7280', fontSize: 11 }} tickLine={false} axisLine={false} minTickGap={28} /><YAxis allowDecimals={false} tick={{ fill: '#6b7280', fontSize: 11 }} tickLine={false} axisLine={false} /><Tooltip content={<ValueTooltip />} cursor={{ fill: '#f0fdf4' }} /><Legend wrapperStyle={{ fontSize: 12, paddingTop: 10 }} /><Bar dataKey="signups" name="New stores" fill="#10b981" radius={[5, 5, 0, 0]} maxBarSize={34} /><Bar dataKey="activated" name="Activated" fill="#38bdf8" radius={[5, 5, 0, 0]} maxBarSize={34} /></BarChart></ResponsiveContainer>
      </ChartCard>
      <ChartCard title="Sales momentum" subtitle="Tenant checkout revenue, day by day" className="analyticsWide" empty={!hasRevenueData && <EmptyChart title="No paid store sales in this period" text="Once active stores complete checkout, their revenue trend will build here." />}>
        <ResponsiveContainer width="100%" height="100%"><AreaChart data={signupData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}><defs><linearGradient id="revenueFill" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#10b981" stopOpacity={.34} /><stop offset="100%" stopColor="#10b981" stopOpacity={.02} /></linearGradient></defs><CartesianGrid vertical={false} stroke="#e8edf0" /><XAxis dataKey="date" tickFormatter={shortDate} tick={{ fill: '#6b7280', fontSize: 11 }} tickLine={false} axisLine={false} minTickGap={28} /><YAxis tickFormatter={(value) => `${Math.round(value / 1000)}k`} tick={{ fill: '#6b7280', fontSize: 11 }} tickLine={false} axisLine={false} /><Tooltip content={<ValueTooltip money />} /><Area type="monotone" dataKey="revenue" name="Revenue" stroke="#059669" strokeWidth={3} fill="url(#revenueFill)" /></AreaChart></ResponsiveContainer>
      </ChartCard>
      <ChartCard title="Plan mix" subtitle={`${metrics.activeTenants || 0} active stores · ${formatUsd(metrics.mrrUsd)} MRR`} empty={!hasPlanData && <EmptyChart title="No active subscriptions yet" text="Your plan distribution will be shown here after the first payment is approved." />}>
        <div className="donutLayout"><ResponsiveContainer width="55%" height="100%"><PieChart><Pie data={planRows} dataKey="stores" nameKey="name" innerRadius="57%" outerRadius="82%" paddingAngle={4} stroke="none">{planRows.map((row) => <Cell key={row.plan} fill={PLAN_COLORS[row.plan] || '#94a3b8'} />)}</Pie></PieChart></ResponsiveContainer><div className="chartLegend">{planRows.map((row) => <div key={row.plan}><i style={{ background: PLAN_COLORS[row.plan] || '#94a3b8' }} /><span>{row.name}</span><strong>{row.stores}</strong></div>)}</div></div>
      </ChartCard>
      <ChartCard title="Portfolio health" subtitle="Which store accounts need attention" empty={!healthRows.length && <EmptyChart title="No store health data yet" text="Health status will appear as stores join the platform." />}>
        <ResponsiveContainer width="100%" height="100%"><BarChart data={healthRows} layout="vertical" margin={{ top: 4, right: 20, left: 8, bottom: 0 }}><CartesianGrid horizontal={false} stroke="#e8edf0" /><XAxis type="number" allowDecimals={false} hide /><YAxis type="category" dataKey="health" tickFormatter={labelize} width={92} tick={{ fill: '#475569', fontSize: 11, fontWeight: 700 }} tickLine={false} axisLine={false} /><Tooltip formatter={(value) => [`${value} stores`, 'Count']} labelFormatter={labelize} /><Bar dataKey="stores" name="Stores" radius={[0, 5, 5, 0]}>{healthRows.map((row) => <Cell key={row.health} fill={HEALTH_COLORS[row.health] || '#94a3b8'} />)}</Bar></BarChart></ResponsiveContainer>
      </ChartCard>
    </div>
  );
}
