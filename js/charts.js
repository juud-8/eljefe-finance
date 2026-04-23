import { historyLastNDays } from './history.js';
import { esc } from './utils.js';

// Draw a tiny line sparkline as inline SVG. `field` is the name of the
// history entry property to read from (netWorth, totalDebt, etc.).
// Returns an SVG string; safe to inject via innerHTML.
export function sparkline(field, days = 90, opts = {}) {
  const width = opts.width || 140;
  const height = opts.height || 22;
  const stroke = opts.stroke || 'var(--gold)';
  const series = historyLastNDays(days)
    .map(h => (h.entry ? +h.entry[field] : null))
    .filter(v => v != null && isFinite(v));
  if (series.length < 2) {
    return `<svg class="kc-spark" viewBox="0 0 ${width} ${height}" width="100%" height="${height}">
      <text x="0" y="${height - 4}" font-size="9" fill="var(--muted2)" font-family="var(--mono)">collecting…</text>
    </svg>`;
  }
  const min = Math.min(...series);
  const max = Math.max(...series);
  const range = (max - min) || 1;
  const step = series.length > 1 ? width / (series.length - 1) : width;
  const points = series.map((v, i) => {
    const x = i * step;
    const y = height - 2 - ((v - min) / range) * (height - 4);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
  const last = series[series.length - 1];
  const first = series[0];
  const trendColor = (() => {
    // Positive trend for netWorth/monthSurplus is good (green). For debt/monthSpent,
    // going up is bad (red). Caller can override.
    if (opts.stroke) return opts.stroke;
    const goodUp = !['totalDebt', 'totalLiabilities', 'monthSpent'].includes(field);
    const diff = last - first;
    if (Math.abs(diff) < range * 0.03) return 'var(--muted)';
    return (diff > 0) === goodUp ? 'var(--green)' : 'var(--red)';
  })();
  return `<svg class="kc-spark" viewBox="0 0 ${width} ${height}" width="100%" height="${height}" preserveAspectRatio="none">
    <polyline fill="none" stroke="${trendColor}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" points="${points}"/>
  </svg>`;
}

// Horizontal bar chart for category breakdown. `data` is [{label, value, color?}]
export function hbars(data, opts = {}) {
  if (!data || !data.length) {
    return '<div style="font-size:12px;color:var(--muted)">No data yet.</div>';
  }
  const total = data.reduce((s, d) => s + (+d.value || 0), 0) || 1;
  const max = Math.max(...data.map(d => +d.value || 0), 1);
  return data.map(d => {
    const pct = Math.round(((+d.value || 0) / max) * 100);
    const share = Math.round(((+d.value || 0) / total) * 100);
    const color = d.color || 'var(--blue)';
    return `<div style="display:flex;align-items:center;gap:10px;margin-bottom:8px">
      <div style="font-size:12px;color:var(--text);width:90px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(d.label)}</div>
      <div style="flex:1;background:var(--border);border-radius:3px;height:7px;overflow:hidden">
        <div style="width:${pct}%;background:${color};height:100%;border-radius:3px"></div>
      </div>
      <div style="font-family:var(--mono);font-size:11px;color:var(--muted);width:72px;text-align:right">${opts.formatValue ? opts.formatValue(d.value) : d.value} · ${share}%</div>
    </div>`;
  }).join('');
}

// Stacked area / overlaid lines for debt projection. `series` is
// [{label, color, values: number[]}]. `labels` optional month labels.
export function projectionChart(series, opts = {}) {
  const width = opts.width || 560;
  const height = opts.height || 180;
  if (!series || !series.length) return '';
  const len = series[0].values.length;
  if (!len) return '';
  let max = 0;
  for (const s of series) for (const v of s.values) if (v > max) max = v;
  if (max <= 0) return '<div style="font-size:12px;color:var(--muted)">No balances to project.</div>';
  const step = len > 1 ? width / (len - 1) : width;
  const lines = series.map(s => {
    const pts = s.values.map((v, i) => `${(i * step).toFixed(1)},${(height - 4 - (v / max) * (height - 8)).toFixed(1)}`).join(' ');
    return `<polyline fill="none" stroke="${s.color}" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round" points="${pts}"/>`;
  }).join('');
  const legend = series.map(s => `<span style="display:inline-flex;align-items:center;gap:4px;margin-right:10px;font-size:11px;color:var(--muted)"><span style="display:inline-block;width:10px;height:2px;background:${s.color}"></span>${esc(s.label)}</span>`).join('');
  return `<svg viewBox="0 0 ${width} ${height}" width="100%" height="${height}" preserveAspectRatio="none" style="display:block">
    ${lines}
  </svg><div style="margin-top:6px;line-height:1.6">${legend}</div>`;
}
