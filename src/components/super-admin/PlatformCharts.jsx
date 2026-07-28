import { useMemo, useState } from 'react';
import { formatKes, formatUsd, hasAnyValue, labelize } from './formatters';

const BARCODE_PALETTE = [
  '#059669',
  '#0ea5e9',
  '#f59e0b',
  '#e11d48',
  '#14b8a6',
  '#2563eb',
  '#d97706',
  '#10b981',
  '#f97316',
  '#0284c7'
];

const PLAN_COLORS = {
  starter: '#0ea5e9',
  growth: '#059669',
  enterprise: '#d97706'
};

const HEALTH_COLORS = {
  healthy: '#059669',
  active: '#0ea5e9',
  new_store: '#14b8a6',
  no_sales: '#f59e0b',
  pending_payment: '#f97316',
  expiring_soon: '#e11d48',
  past_due: '#be123c',
  suspended: '#64748b'
};

function EmptyChartState({ title, text }) {
  return (
    <div className="emptyChart">
      <strong>{title}</strong>
      <span>{text}</span>
    </div>
  );
}

function ChartPanel({ title, meta, children, hasData = true, emptyTitle, emptyText, wide = false }) {
  return (
    <section className={`panel barcodePanel ${wide ? 'barcodePanelWide' : ''}`}>
      <div className="panelHeader">
        <h2>{title}</h2>
        <span>{meta}</span>
      </div>
      <div className="barcodeFrame">
        {hasData ? children : <EmptyChartState title={emptyTitle} text={emptyText} />}
      </div>
    </section>
  );
}

function toneForValue(value, max, palette = BARCODE_PALETTE) {
  if (!max || value <= 0) return '#cbd5e1';
  const ratio = value / max;
  const index = Math.min(palette.length - 1, Math.floor(ratio * (palette.length - 1)));
  return palette[index];
}

function barWidthForValue(value, max) {
  if (!max || value <= 0) return 2;
  return Math.max(2, Math.round(2 + (value / max) * 10));
}

function BarcodeStrip({
  rows,
  valueKey,
  labelKey = 'date',
  formatValue,
  ariaLabel,
  emptyFallback = 0
}) {
  const [hover, setHover] = useState(null);
  const max = useMemo(
    () => Math.max(...rows.map((row) => Number(row[valueKey] || 0)), emptyFallback),
    [rows, valueKey, emptyFallback]
  );

  return (
    <div className="barcodeStripWrap">
      <div
        className="barcodeStrip"
        role="img"
        aria-label={ariaLabel}
        onMouseLeave={() => setHover(null)}
      >
        <div className="barcodeScanLine" aria-hidden="true" />
        {rows.map((row, index) => {
          const value = Number(row[valueKey] || 0);
          const height = max > 0 ? Math.max(12, Math.round((value / max) * 100)) : 12;
          const width = barWidthForValue(value, max);
          const color = toneForValue(value, max);
          const label = row[labelKey];
          return (
            <button
              key={`${label}-${index}`}
              type="button"
              className={`barcodeBar ${value <= 0 ? 'barcodeBarQuiet' : ''}`}
              style={{
                height: `${height}%`,
                width: `${width}px`,
                background: color,
                animationDelay: `${(index % 12) * 40}ms`
              }}
              title={`${label}: ${formatValue(value)}`}
              aria-label={`${label}: ${formatValue(value)}`}
              onMouseEnter={() => setHover({ label, value, color })}
              onFocus={() => setHover({ label, value, color })}
              onBlur={() => setHover(null)}
            />
          );
        })}
      </div>
      <div className="barcodeHud">
        {hover ? (
          <>
            <span className="barcodeHudSwatch" style={{ background: hover.color }} />
            <strong>{hover.label}</strong>
            <span>{formatValue(hover.value)}</span>
          </>
        ) : (
          <span className="barcodeHudHint">Hover a bar to read the scan</span>
        )}
      </div>
    </div>
  );
}

function DualBarcodeStrip({ rows, primaryKey, secondaryKey, primaryLabel, secondaryLabel }) {
  const [hover, setHover] = useState(null);
  const maxPrimary = Math.max(...rows.map((row) => Number(row[primaryKey] || 0)), 1);
  const maxSecondary = Math.max(...rows.map((row) => Number(row[secondaryKey] || 0)), 1);

  return (
    <div className="barcodeStripWrap">
      <div className="barcodeStrip barcodeStripDual" role="img" aria-label={`${primaryLabel} and ${secondaryLabel}`}>
        <div className="barcodeScanLine" aria-hidden="true" />
        {rows.map((row, index) => {
          const primary = Number(row[primaryKey] || 0);
          const secondary = Number(row[secondaryKey] || 0);
          const primaryHeight = Math.max(10, Math.round((primary / maxPrimary) * 100));
          const secondaryHeight = Math.max(8, Math.round((secondary / maxSecondary) * 72));
          return (
            <div
              key={`${row.date}-${index}`}
              className="barcodePair"
              onMouseEnter={() => setHover(row)}
              onMouseLeave={() => setHover(null)}
            >
              <span
                className="barcodeBar barcodeBarPrimary"
                style={{
                  height: `${primaryHeight}%`,
                  width: `${barWidthForValue(primary, maxPrimary)}px`,
                  background: toneForValue(primary, maxPrimary, ['#34d399', '#059669', '#047857', '#065f46']),
                  animationDelay: `${(index % 10) * 35}ms`
                }}
              />
              <span
                className="barcodeBar barcodeBarSecondary"
                style={{
                  height: `${secondaryHeight}%`,
                  width: `${Math.max(2, barWidthForValue(secondary, maxSecondary) - 1)}px`,
                  background: toneForValue(secondary, maxSecondary, ['#fcd34d', '#f59e0b', '#d97706', '#b45309']),
                  animationDelay: `${(index % 10) * 35 + 20}ms`
                }}
              />
            </div>
          );
        })}
      </div>
      <div className="barcodeLegendRow">
        <span><i style={{ background: '#059669' }} /> {primaryLabel}</span>
        <span><i style={{ background: '#d97706' }} /> {secondaryLabel}</span>
      </div>
      <div className="barcodeHud">
        {hover ? (
          <>
            <strong>{hover.date}</strong>
            <span>{primaryLabel}: {formatKes(hover[primaryKey])}</span>
            <span>{secondaryLabel}: {hover[secondaryKey] || 0}</span>
          </>
        ) : (
          <span className="barcodeHudHint">Each pair is a day&apos;s sales barcode</span>
        )}
      </div>
    </div>
  );
}

function PlanBarcodeCards({ planRows, mrrUsd }) {
  const maxMrr = Math.max(...planRows.map((row) => Number(row.mrrUsd || 0)), 1);

  return (
    <div className="planBarcodeGrid">
      {planRows.map((plan) => {
        const bars = 18;
        const filled = Math.max(1, Math.round((Number(plan.mrrUsd || 0) / maxMrr) * bars));
        const color = PLAN_COLORS[plan.plan] || '#64748b';
        return (
          <article className="planBarcodeCard" key={plan.plan}>
            <div className="planBarcodeTop">
              <span className={`planBadge ${plan.plan}`}>{plan.name}</span>
              <strong>{formatUsd(plan.mrrUsd)}</strong>
            </div>
            <div className="planBarcodeVisual" role="img" aria-label={`${plan.name} MRR barcode`}>
              {Array.from({ length: bars }, (_, index) => {
                const active = index < filled;
                const width = active ? (index % 3 === 0 ? 5 : index % 2 === 0 ? 3 : 2) : 2;
                return (
                  <span
                    key={`${plan.plan}-${index}`}
                    className={`planBarcodeBar ${active ? 'isOn' : ''}`}
                    style={{
                      width: `${width}px`,
                      background: active ? color : '#e2e8f0',
                      animationDelay: `${index * 30}ms`
                    }}
                  />
                );
              })}
            </div>
            <div className="planBarcodeMeta">
              <span>{plan.stores || 0} stores</span>
              <span>{mrrUsd > 0 ? `${Math.round((Number(plan.mrrUsd || 0) / mrrUsd) * 100)}% of MRR` : '—'}</span>
            </div>
          </article>
        );
      })}
    </div>
  );
}

function HealthBarcode({ healthRows }) {
  const total = healthRows.reduce((sum, row) => sum + Number(row.stores || 0), 0) || 1;

  return (
    <div className="healthBarcodeWrap">
      <div className="healthBarcodeTrack" role="img" aria-label="Tenant health barcode">
        <div className="barcodeScanLine barcodeScanLineSlow" aria-hidden="true" />
        {healthRows.map((entry) => {
          const stores = Number(entry.stores || 0);
          const flex = Math.max(stores / total, 0.08);
          const color = HEALTH_COLORS[entry.health] || BARCODE_PALETTE[0];
          return (
            <div
              key={entry.health}
              className="healthBarcodeSegment"
              style={{ flex, background: color }}
              title={`${labelize(entry.health)}: ${stores}`}
            >
              {Array.from({ length: Math.min(Math.max(stores * 3, 4), 16) }, (_, index) => (
                <i
                  key={`${entry.health}-${index}`}
                  style={{
                    width: `${index % 4 === 0 ? 4 : 2}px`,
                    opacity: 0.35 + ((index % 5) * 0.1)
                  }}
                />
              ))}
            </div>
          );
        })}
      </div>
      <div className="healthLegend barcodeHealthLegend">
        {healthRows.map((entry) => (
          <span key={entry.health}>
            <i style={{ background: HEALTH_COLORS[entry.health] || '#64748b' }} />
            {labelize(entry.health)}: {entry.stores}
          </span>
        ))}
      </div>
    </div>
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
    <div className="chartGrid barcodeChartGrid">
      <ChartPanel
        title="Store signup barcode"
        meta={`${rangeDays}-day scan`}
        hasData={hasSignupSignal}
        emptyTitle="No new stores in this range"
        emptyText="New tenant signups and activations will light up this barcode once the funnel starts moving."
        wide
      >
        <BarcodeStrip
          rows={signupRows}
          valueKey="signups"
          formatValue={(value) => `${value} signup${value === 1 ? '' : 's'}`}
          ariaLabel="Store signups as a colorful barcode"
        />
        <div className="barcodeLegendRow">
          <span><i style={{ background: '#059669' }} /> Quiet days fade to slate</span>
          <span><i style={{ background: '#0ea5e9' }} /> Hotter signup days go brighter</span>
        </div>
      </ChartPanel>

      <ChartPanel
        title="POS sales signal"
        meta="Tenant checkout pulse"
        hasData={hasSalesSignal}
        emptyTitle="No tenant POS sales yet"
        emptyText="This barcode stays quiet until an active store completes paid checkout orders."
        wide
      >
        <DualBarcodeStrip
          rows={signupRows}
          primaryKey="revenue"
          secondaryKey="paidOrders"
          primaryLabel="Revenue"
          secondaryLabel="Paid orders"
        />
      </ChartPanel>

      <ChartPanel
        title="Plan economics"
        meta={`${formatUsd(metrics.mrrUsd)} MRR`}
        hasData={hasPlanSignal}
        emptyTitle="No paid plan mix yet"
        emptyText="Confirmed subscriptions will show revenue barcodes by tier here."
      >
        <PlanBarcodeCards planRows={planRows} mrrUsd={metrics.mrrUsd || 0} />
      </ChartPanel>

      <ChartPanel
        title="Tenant health"
        meta="Risk barcode"
        hasData={healthRows.length > 0}
        emptyTitle="No tenant health data yet"
        emptyText="Tenant risk states will appear after stores start onboarding."
      >
        <HealthBarcode healthRows={healthRows} />
      </ChartPanel>
    </div>
  );
}
