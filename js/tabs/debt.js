import { $$, esc, fmtMonths, daysUntil, debtPayoff, simulatePayoff, setIfNotFocused } from '../utils.js';
import { sparkline, projectionChart } from '../charts.js';

const DEBT_TYPES = ['Credit card', 'Student loan', 'Auto loan', 'Mortgage', 'Personal', 'Medical', 'Other'];

// Extra-payment amount, kept in module scope so typing into the simulator
// field doesn't re-render + blur on every keystroke.
let _extraPayment = 0;
export function setExtraPayment(v) {
  _extraPayment = Math.max(0, +v || 0);
}
export function getExtraPayment() { return _extraPayment; }

function renderSimulator(S) {
  const out = document.getElementById('sim-output');
  if (!out || !S) return;
  const snow = simulatePayoff(S.debts, _extraPayment, 'snowball');
  const aval = simulatePayoff(S.debts, _extraPayment, 'avalanche');
  const rowHtml = (label, sim) => `
    <div class="sim-row"><span>Months to debt-free</span><span class="mono">${fmtMonths(sim.months)}</span></div>
    <div class="sim-row"><span>Total interest</span><span class="mono">${isFinite(sim.totalInterest) ? $$(sim.totalInterest) : '∞'}</span></div>
  `;
  const diff = (isFinite(aval.totalInterest) && isFinite(snow.totalInterest))
    ? snow.totalInterest - aval.totalInterest
    : null;
  out.innerHTML = `
    <div class="sim-grid">
      <div class="sim-col">
        <h4>Snowball (smallest first)</h4>
        ${rowHtml('Snowball', snow)}
      </div>
      <div class="sim-col">
        <h4>Avalanche (highest APR first)</h4>
        ${rowHtml('Avalanche', aval)}
      </div>
    </div>
    ${diff != null && Math.abs(diff) > 1
      ? `<div class="sim-savings">Avalanche saves <strong>${$$(Math.abs(diff))}</strong> vs snowball${_extraPayment > 0 ? ` with +${$$(_extraPayment)}/mo extra` : ''}</div>`
      : ''}
  `;

  // Payoff projection chart (next 24 months)
  const projEl = document.getElementById('debt-projection');
  if (projEl) {
    const palette = ['var(--gold)', 'var(--red)', 'var(--green)', 'var(--blue)', '#a855f7', '#06b6d4', '#f97316', '#eab308', '#ec4899', '#94a3b8'];
    const top = [...S.debts].filter(d => (+d.balance || 0) > 0).sort((a, b) => (+b.balance || 0) - (+a.balance || 0)).slice(0, 6);
    const months = 24;
    const series = top.map((d, i) => {
      const values = [];
      let bal = +d.balance || 0;
      const r = Math.max(+d.apr || 0, 0) / 100 / 12;
      const m = +d.minPayment || 0;
      for (let k = 0; k < months; k++) {
        values.push(Math.max(0, bal));
        const interest = bal * r;
        bal = Math.max(0, bal + interest - m);
      }
      return { label: d.name || '(untitled)', color: palette[i % palette.length], values };
    });
    if (series.length) {
      projEl.innerHTML = projectionChart(series, { height: 160 });
    } else {
      projEl.innerHTML = '<div style="font-size:12px;color:var(--muted)">Add debts with balances to see projections.</div>';
    }
  }
}

function dueSoonBanner(S) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = S.debts
    .filter(d => d.dueDate && (+d.balance || 0) > 0)
    .map(d => ({ d, days: daysUntil(d.dueDate) }))
    .filter(x => x.days >= 0 && x.days <= 7)
    .sort((a, b) => a.days - b.days);
  if (!due.length) return '';
  const items = due.map(x => `${esc(x.d.name)} — in ${x.days}d (${esc(x.d.dueDate)})`).join(' · ');
  return `<div class="warn-banner">⏰ Due within 7 days: ${items}</div>`;
}

export function renderDebt(S) {
  const tb = document.getElementById('debt-tb');
  const kpis = document.getElementById('debt-kpis');
  const snow = document.getElementById('debt-snowball');
  const aval = document.getElementById('debt-avalanche');
  if (!tb || !kpis) return;

  const dueEl = document.getElementById('debt-due-banner');
  if (dueEl) dueEl.innerHTML = dueSoonBanner(S);

  const rows = S.debts.map(d => ({ d, p: debtPayoff(d.balance, d.apr, d.minPayment) }));
  const typeOpts = (sel) => DEBT_TYPES.map(t => `<option value="${esc(t)}"${t === sel ? ' selected' : ''}>${esc(t)}</option>`).join('');

  tb.innerHTML = rows.map(({ d, p }) => {
    const bal = +d.balance || 0;
    const col = p.never ? 'var(--red)' : 'var(--text)';
    const warnNever = p.never && bal > 0
      ? `<div style="font-size:10px;color:var(--red);margin-top:2px">⚠ min ≤ monthly interest</div>`
      : '';
    return `<tr>
      <td>
        <input class="namei" data-fid="debt-${d.id}-name" value="${esc(d.name)}" onchange="upDebt(${d.id},'name',this.value)"/>
        ${warnNever}
      </td>
      <td><select class="namei" data-fid="debt-${d.id}-type" style="background:transparent" onchange="upDebt(${d.id},'type',this.value)">${typeOpts(d.type || 'Other')}</select></td>
      <td class="r"><input class="ni" data-fid="debt-${d.id}-balance" type="number" inputmode="decimal" min="0" step="0.01" value="${bal || ''}" placeholder="0" onchange="upDebt(${d.id},'balance',+this.value||0)" style="color:var(--red)"/></td>
      <td class="r"><input class="ni" data-fid="debt-${d.id}-apr" type="number" inputmode="decimal" min="0" step="0.01" value="${d.apr || ''}" placeholder="0" onchange="upDebt(${d.id},'apr',+this.value||0)"/></td>
      <td class="r"><input class="ni" data-fid="debt-${d.id}-min" type="number" inputmode="decimal" min="0" step="0.01" value="${d.minPayment || ''}" placeholder="0" onchange="upDebt(${d.id},'minPayment',+this.value||0)"/></td>
      <td class="r"><input type="date" class="ni" data-fid="debt-${d.id}-due" style="width:130px;text-align:left" value="${esc(d.dueDate || '')}" onchange="upDebt(${d.id},'dueDate',this.value||'')"/></td>
      <td class="r" style="font-family:var(--mono);font-size:12px;color:${col}">${bal > 0 ? fmtMonths(p.months) : '—'}</td>
      <td><button class="db" onclick="delDebt(${d.id})" aria-label="Remove">×</button></td>
    </tr>`;
  }).join('');

  const totalBal = S.debts.reduce((s, d) => s + (+d.balance || 0), 0);
  const totalMin = S.debts.reduce((s, d) => s + (+d.minPayment || 0), 0);
  const weightedApr = totalBal > 0
    ? S.debts.reduce((s, d) => s + (+d.balance || 0) * (+d.apr || 0), 0) / totalBal
    : 0;
  const totalInterestIfMin = rows.reduce((s, { p }) => s + (isFinite(p.totalInterest) ? p.totalInterest : 0), 0);
  const monthlyInterestNow = S.debts.reduce((s, d) => s + ((+d.balance || 0) * ((+d.apr || 0) / 100 / 12)), 0);
  const anyNever = rows.some(r => r.p.never && (+r.d.balance || 0) > 0);

  kpis.innerHTML = `
    <div class="kc"><div class="kl">Total debt</div><div class="kv" style="color:${totalBal > 0 ? 'var(--red)' : 'var(--text)'}">${$$(totalBal)}</div><div class="ks">${S.debts.filter(d => (+d.balance || 0) > 0).length} active</div>${sparkline('totalDebt', 180)}</div>
    <div class="kc"><div class="kl">Avg APR</div><div class="kv">${weightedApr.toFixed(2)}%</div><div class="ks">Balance-weighted</div></div>
    <div class="kc"><div class="kl">Min / month</div><div class="kv" style="color:var(--red)">${$$(totalMin)}</div><div class="ks">${$$(monthlyInterestNow)} is interest</div></div>
    <div class="kc"><div class="kl">Interest to payoff</div><div class="kv" style="color:${anyNever ? 'var(--red)' : 'var(--gold)'}">${anyNever ? '∞' : $$(totalInterestIfMin)}</div><div class="ks">At min payments</div></div>
  `;

  const active = rows.filter(r => (+r.d.balance || 0) > 0);
  const orderRow = ({ d, p }) => `
    <div style="display:flex;justify-content:space-between;align-items:baseline;padding:6px 0;border-bottom:1px solid var(--border)">
      <span style="font-size:12px">${esc(d.name || '(untitled)')}</span>
      <span style="font-family:var(--mono);font-size:11px;color:var(--muted)">${$$(+d.balance || 0)} · ${(+d.apr || 0).toFixed(2)}% · ${fmtMonths(p.months)}</span>
    </div>`;
  if (snow) {
    const s = [...active].sort((a, b) => (+a.d.balance || 0) - (+b.d.balance || 0));
    snow.innerHTML = s.length ? s.map(orderRow).join('') : '<span style="font-size:12px;color:var(--muted)">Add debts with balances to see order.</span>';
  }
  if (aval) {
    const a = [...active].sort((x, y) => (+y.d.apr || 0) - (+x.d.apr || 0));
    aval.innerHTML = a.length ? a.map(orderRow).join('') : '<span style="font-size:12px;color:var(--muted)">Add debts with balances to see order.</span>';
  }

  // Keep simulator input value reflected but don't stomp focus
  setIfNotFocused('sim-extra', _extraPayment || '');
  renderSimulator(S);
}
