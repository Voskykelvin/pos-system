export function formatUsd(amount) {
  return `$${Number(amount || 0).toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  })}`;
}

export function formatKes(amount) {
  return `KES ${Number(amount || 0).toLocaleString(undefined, {
    maximumFractionDigits: 0
  })}`;
}

export function compactKes(amount) {
  const value = Number(amount || 0);
  if (Math.abs(value) >= 1000000) return `KES ${(value / 1000000).toFixed(1)}M`;
  if (Math.abs(value) >= 1000) return `KES ${(value / 1000).toFixed(0)}K`;
  return `KES ${value.toFixed(0)}`;
}

export function formatPercent(value) {
  const number = Number(value || 0);
  const rounded = Number(number.toFixed(1));
  return `${Number.isInteger(rounded) ? rounded.toFixed(0) : rounded.toFixed(1)}%`;
}

export function labelize(value) {
  return String(value || '').replace(/_/g, ' ');
}

export function formatDate(value) {
  if (!value) return '-';
  return new Date(value).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
}

export function daysText(value) {
  if (value === null || value === undefined) return 'No active period';
  if (value < 0) return `${Math.abs(value)} day${Math.abs(value) === 1 ? '' : 's'} overdue`;
  return `${value} day${value === 1 ? '' : 's'} left`;
}

export function hasAnyValue(rows = [], keys = []) {
  return rows.some((row) => keys.some((key) => Number(row?.[key] || 0) > 0));
}

export function nonZeroTick(value) {
  return Number(value || 0) === 0 ? '' : value;
}

export function nonZeroKesTick(value) {
  return Number(value || 0) === 0 ? '' : compactKes(value);
}
