export const $$ = n => new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
}).format(n || 0);

export const $$c = n => new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
}).format(n || 0);

export const pc = (a, b) => (b > 0 ? Math.min(100, Math.round((a / b) * 100)) : 0);

export const esc = s => String(s ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

export function fmtMonths(mo) {
  if (!isFinite(mo)) return 'never';
  if (mo <= 0) return '—';
  const y = Math.floor(mo / 12);
  const m = mo % 12;
  if (y <= 0) return m + 'mo';
  if (m === 0) return y + 'y';
  return y + 'y ' + m + 'mo';
}

export function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export function monthISO(d = new Date()) {
  return d.toISOString().slice(0, 7);
}

export function daysUntil(iso) {
  const target = new Date(iso + 'T00:00:00');
  const now = new Date();
  return Math.round((target - now) / 86400000);
}

// Core payoff math: how long at fixed APR + minimum payment.
export function debtPayoff(balance, apr, minPayment) {
  const b = +balance || 0;
  const a = +apr || 0;
  const m = +minPayment || 0;
  if (b <= 0) return { months: 0, totalInterest: 0, never: false };
  const r = Math.max(a, 0) / 100 / 12;
  const monthlyInterest = b * r;
  if (m <= 0) return { months: Infinity, totalInterest: Infinity, never: true };
  if (r > 0 && m <= monthlyInterest + 0.005) {
    return { months: Infinity, totalInterest: Infinity, never: true };
  }
  let months;
  if (r === 0) {
    months = Math.ceil(b / m);
  } else {
    months = Math.ceil(Math.log(m / (m - r * b)) / Math.log(1 + r));
  }
  const totalPaid = months * m;
  const totalInterest = Math.max(0, totalPaid - b);
  return { months, totalInterest, never: false };
}

// Month-by-month simulation of a debt set under snowball or avalanche.
// Freed-up minimum payments roll forward (classic snowball method): when a
// debt is paid off, its monthly minimum becomes additional "extra" that
// attacks the next debt in the strategy order.
export function simulatePayoff(debts, extraPerMonth, strategy = 'avalanche', capMonths = 600) {
  const list = debts
    .filter(d => (+d.balance || 0) > 0)
    .map(d => ({
      id: d.id,
      name: d.name || '',
      balance: +d.balance || 0,
      apr: +d.apr || 0,
      min: +d.minPayment || 0,
    }));
  if (!list.length) {
    return { months: 0, totalInterest: 0, order: [], trail: [], never: false };
  }
  const order = [...list].sort((a, b) => {
    if (strategy === 'avalanche') return b.apr - a.apr || a.balance - b.balance;
    return a.balance - b.balance || b.apr - a.apr;
  });
  const state = new Map(list.map(d => [d.id, { ...d }]));
  const baseExtra = Math.max(0, +extraPerMonth || 0);
  let months = 0;
  let totalInterest = 0;
  const trail = [];
  while ([...state.values()].some(d => d.balance > 0.005) && months < capMonths) {
    let monthInterest = 0;
    for (const d of state.values()) {
      if (d.balance <= 0) continue;
      const r = Math.max(d.apr, 0) / 100 / 12;
      const interest = d.balance * r;
      d.balance += interest;
      monthInterest += interest;
    }
    let totalMin = 0;
    let freedMin = 0;
    for (const d of state.values()) {
      if (d.balance <= 0) {
        freedMin += d.min; // minimum freed from an already-paid-off debt
        continue;
      }
      const pay = Math.min(d.min, d.balance);
      d.balance -= pay;
      totalMin += pay;
    }
    let extra = baseExtra + freedMin;
    for (const o of order) {
      if (extra <= 0) break;
      const d = state.get(o.id);
      if (!d || d.balance <= 0) continue;
      const pay = Math.min(extra, d.balance);
      d.balance -= pay;
      extra -= pay;
    }
    totalInterest += monthInterest;
    months++;
    if (months <= capMonths) {
      trail.push({
        month: months,
        balances: Object.fromEntries([...state.entries()].map(([id, d]) => [id, Math.max(0, d.balance)])),
      });
    }
    // Stall detection: if this month's total outflow can't exceed this
    // month's interest, we're going backwards and should bail.
    const canProgress = [...state.values()].some(d => d.balance > 0);
    const monthOutflow = totalMin + baseExtra + freedMin;
    if (canProgress && monthOutflow <= monthInterest + 0.005) {
      return { months: Infinity, totalInterest: Infinity, order: order.map(o => o.id), trail, never: true };
    }
  }
  const never = months >= capMonths && [...state.values()].some(d => d.balance > 0.01);
  return {
    months: never ? Infinity : months,
    totalInterest: never ? Infinity : totalInterest,
    order: order.map(o => o.id),
    trail,
    never,
  };
}

export function setIfNotFocused(id, val) {
  const el = typeof id === 'string' ? document.getElementById(id) : id;
  if (el && document.activeElement !== el) el.value = val;
}

let _focusState = null;

export function saveFocus() {
  const ae = document.activeElement;
  if (!ae || ae === document.body) { _focusState = null; return; }
  const fid = ae.getAttribute && ae.getAttribute('data-fid');
  if (!fid && !ae.id) { _focusState = null; return; }
  let selStart = null;
  let selEnd = null;
  try {
    if (ae.selectionStart != null) {
      selStart = ae.selectionStart;
      selEnd = ae.selectionEnd;
    }
  } catch { /* some input types disallow selection access */ }
  _focusState = {
    id: ae.id || null,
    fid: fid || null,
    selStart,
    selEnd,
  };
}

export function restoreFocus() {
  if (!_focusState) return;
  const { id, fid, selStart, selEnd } = _focusState;
  _focusState = null;
  let el = null;
  if (id) el = document.getElementById(id);
  if (!el && fid) {
    try { el = document.querySelector(`[data-fid="${CSS.escape(fid)}"]`); } catch { el = null; }
  }
  if (!el) return;
  try {
    el.focus({ preventScroll: true });
    if (selStart != null && selEnd != null && typeof el.setSelectionRange === 'function') {
      el.setSelectionRange(selStart, selEnd);
    }
  } catch { /* not focusable for some reason */ }
}

export function toast(msg, kind = '') {
  let host = document.querySelector('.toasts');
  if (!host) {
    host = document.createElement('div');
    host.className = 'toasts';
    document.body.appendChild(host);
  }
  const el = document.createElement('div');
  el.className = 'toast' + (kind ? ' ' + kind : '');
  el.textContent = msg;
  host.appendChild(el);
  setTimeout(() => {
    el.style.transition = 'opacity .2s, transform .2s';
    el.style.opacity = '0';
    el.style.transform = 'translateY(6px)';
    setTimeout(() => el.remove(), 220);
  }, 3200);
}
