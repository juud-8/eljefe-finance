import { $$, esc, monthISO, todayISO } from '../utils.js';
import { hbars } from '../charts.js';

// Anchor any date handling to local noon so tz offset never flips the day.
function parseDateAtNoon(iso) {
  return new Date(iso + 'T12:00:00');
}

export function getExpenseCats(S) {
  const u = new Set(S.expenses.map(e => e.cat).filter(Boolean));
  ['Bills', 'Business', 'Debt', 'Food', 'Health', 'Housing', 'Lifestyle', 'Other', 'Savings', 'Transport']
    .forEach(c => u.add(c));
  return [...u].sort((a, b) => a.localeCompare(b));
}

export function expenseLogMonthTotal(S) {
  const now = new Date();
  const y = now.getFullYear();
  const mo = now.getMonth();
  return S.expenseLog.filter(e => {
    const d = parseDateAtNoon(e.date);
    return d.getFullYear() === y && d.getMonth() === mo;
  }).reduce((s, e) => s + (+e.amount || 0), 0);
}

function applyFilters(S) {
  const f = S.ui?.expenseFilter || {};
  return S.expenseLog.filter(e => {
    if (f.cat && e.cat !== f.cat) return false;
    if (f.from && e.date < f.from) return false;
    if (f.to && e.date > f.to) return false;
    if (f.min && +e.amount < +f.min) return false;
    return true;
  });
}

function categoryBreakdown(S) {
  const now = new Date();
  const y = now.getFullYear();
  const mo = now.getMonth();
  const map = new Map();
  for (const e of S.expenseLog) {
    const d = parseDateAtNoon(e.date);
    if (d.getFullYear() !== y || d.getMonth() !== mo) continue;
    const k = e.cat || 'Other';
    map.set(k, (map.get(k) || 0) + (+e.amount || 0));
  }
  return [...map.entries()]
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value);
}

// Module-scoped so saving to the library doesn't stomp the form the user
// just typed into.
let expFormPrefill = null;
export function setExpensePrefill(p) { expFormPrefill = p; }

export function renderSpending(S) {
  const pf = expFormPrefill || {};
  expFormPrefill = null;
  const today = todayISO();
  const dateEl = document.getElementById('exp-date');
  if (dateEl) dateEl.value = pf.date || dateEl.value || today;
  const nameEl = document.getElementById('exp-name');
  if (nameEl && pf.name != null) nameEl.value = pf.name;
  const amtEl = document.getElementById('exp-amt');
  if (amtEl && pf.amount > 0) amtEl.value = String(pf.amount);

  const cats = getExpenseCats(S);
  const selCat = pf.cat && cats.includes(pf.cat) ? pf.cat : (cats[0] || 'Other');
  const catEl = document.getElementById('exp-cat');
  if (catEl) {
    catEl.innerHTML = cats.map(c => `<option value="${esc(c)}">${esc(c)}</option>`).join('');
    if (pf.cat) catEl.value = selCat;
    else if (!catEl.value) catEl.value = selCat;
  }

  // Filter dropdown mirrors the same category list (plus "All").
  const filtCat = document.getElementById('exp-filter-cat');
  if (filtCat) {
    const current = S.ui?.expenseFilter?.cat || '';
    filtCat.innerHTML = `<option value="">All categories</option>` + cats.map(c => `<option value="${esc(c)}"${c === current ? ' selected' : ''}>${esc(c)}</option>`).join('');
  }
  const setFilterVal = (id, val) => {
    const el = document.getElementById(id);
    if (el && document.activeElement !== el) el.value = val ?? '';
  };
  const f = S.ui?.expenseFilter || {};
  setFilterVal('exp-filter-from', f.from);
  setFilterVal('exp-filter-to', f.to);
  setFilterVal('exp-filter-min', f.min);

  const libEl = document.getElementById('exp-lib');
  const libEmpty = document.getElementById('exp-lib-empty');
  if (libEl) {
    if (!S.expenseLibrary.length) {
      libEl.innerHTML = '';
      if (libEmpty) libEmpty.textContent = 'No templates yet.';
    } else {
      if (libEmpty) libEmpty.textContent = '';
      libEl.innerHTML = S.expenseLibrary.map(t => `
        <div class="lib-chip">
          <button type="button" class="lib-main" onclick="useExpenseLib(${t.id})">${esc(t.name)} <span class="lib-amt">${esc(t.cat)}${t.amount > 0 ? ' · ' + $$(t.amount) : ''}</span></button>
          <button type="button" class="lib-x" onclick="delExpenseLibItem(${t.id})" title="Remove template" aria-label="Remove template">×</button>
        </div>
      `).join('');
    }
  }

  const sumEl = document.getElementById('exp-month-sum');
  if (sumEl) sumEl.innerHTML = `This month (logged): <strong>${$$(expenseLogMonthTotal(S))}</strong>`;

  // Category breakdown for the current month.
  const catEl2 = document.getElementById('exp-cat-breakdown');
  if (catEl2) {
    const data = categoryBreakdown(S);
    if (!data.length) {
      catEl2.innerHTML = '<div style="font-size:12px;color:var(--muted)">No expenses logged this month yet.</div>';
    } else {
      catEl2.innerHTML = hbars(data, { formatValue: v => $$(v) });
    }
  }

  // Filtered log + running total.
  const filtered = applyFilters(S).sort((a, b) => {
    if (a.date !== b.date) return b.date.localeCompare(a.date);
    return (b.id || 0) - (a.id || 0);
  });
  const logTb = document.getElementById('exp-log-tb');
  const logEmpty = document.getElementById('exp-log-empty');
  const filtSum = document.getElementById('exp-filter-sum');
  if (logTb) {
    logTb.innerHTML = filtered.map(e => `
      <tr>
        <td style="font-family:var(--mono);font-size:12px;color:var(--muted)">${esc(e.date)}</td>
        <td>${esc(e.name)}</td>
        <td style="font-size:11px;color:var(--muted)">${esc(e.cat)}</td>
        <td class="r" style="font-family:var(--mono);color:var(--red)">${$$(e.amount)}</td>
        <td><button class="db" type="button" onclick="delExpenseLogRow(${e.id})" title="Remove entry" aria-label="Remove entry">×</button></td>
      </tr>
    `).join('');
  }
  if (logEmpty) {
    const anyFilter = !!(f.cat || f.from || f.to || f.min);
    logEmpty.textContent = filtered.length ? '' : (anyFilter ? 'No entries match the filters.' : 'No entries yet.');
  }
  if (filtSum) {
    const total = filtered.reduce((s, e) => s + (+e.amount || 0), 0);
    const anyFilter = !!(f.cat || f.from || f.to || f.min);
    filtSum.innerHTML = anyFilter
      ? `Filtered total: <strong>${$$(total)}</strong> across ${filtered.length} ${filtered.length === 1 ? 'entry' : 'entries'}`
      : '';
  }
}
