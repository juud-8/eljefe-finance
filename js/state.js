import { DEF } from './defaults.js';
import { snapshotToday, runMonthRolloverIfNeeded } from './history.js';

export const SK = 'eljefe-fin-v6';
export const SK_OLD_KEYS = ['eljefe-fin-v5', 'eljefe-fin-v4', 'eljefe-fin-v3', 'eljefe-fin-v2', 'eljefe-fin'];

function deepClone(o) { return JSON.parse(JSON.stringify(o)); }

export let S = deepClone(DEF);

let _nid = 200;
export function nextId() { return ++_nid; }
export function currentNid() { return _nid; }

const _renderers = [];
export function subscribeRender(fn) { _renderers.push(fn); }

function fireRender() {
  for (const fn of _renderers) {
    try { fn(S); } catch (e) { console.error('[eljefe-fin] render error', e); }
  }
}

// Merge saved data on top of the default skeleton. This is the migration path
// for schema changes: new fields appear in DEF, unknown saved fields are
// preserved on the matching branches.
export function migrate(raw) {
  const base = deepClone(DEF);
  if (!raw || typeof raw !== 'object') return base;

  const preserveArray = (key) => {
    if (Array.isArray(raw[key])) base[key] = raw[key].map(item => ({ ...item }));
  };
  ['income', 'expenses', 'assets', 'liabilities', 'debts', 'goals', 'expenseLog', 'expenseLibrary']
    .forEach(preserveArray);

  // Ensure debts have dueDate (added in v6).
  for (const d of base.debts) {
    if (!('dueDate' in d)) d.dueDate = '';
  }
  // Ensure assets/liabilities have lastUpdated (added in v6).
  for (const a of base.assets) if (!('lastUpdated' in a)) a.lastUpdated = '';
  for (const l of base.liabilities) if (!('lastUpdated' in l)) l.lastUpdated = '';

  if (raw.moveIn && typeof raw.moveIn === 'object') {
    base.moveIn = { ...base.moveIn, ...raw.moveIn };
  }
  if (raw.cashApp && typeof raw.cashApp === 'object') {
    const ca = raw.cashApp;
    base.cashApp = {
      ...base.cashApp,
      ...ca,
      btc: { ...base.cashApp.btc, ...(ca.btc || {}) },
      borrow: { ...base.cashApp.borrow, ...(ca.borrow || {}) },
      stocks: Array.isArray(ca.stocks) ? ca.stocks.map(s => ({ ...s })) : base.cashApp.stocks,
      activity: Array.isArray(ca.activity) ? ca.activity.map(a => ({ ...a })) : base.cashApp.activity,
    };
    // Borrow.kind defaults to 'flat' for new users; old saves that have no
    // kind field but do have an apr > 0 should stay on 'apr' to not surprise.
    if (!base.cashApp.borrow.kind) {
      base.cashApp.borrow.kind = (+base.cashApp.borrow.apr > 0) ? 'apr' : 'flat';
    }
    if (typeof base.cashApp.borrow.feePct !== 'number') base.cashApp.borrow.feePct = 5;
  }
  if (raw.history && typeof raw.history === 'object') {
    base.history = { ...base.history, ...raw.history };
    if (!base.history.monthlySpent) base.history.monthlySpent = {};
  }
  if (raw.ui && typeof raw.ui === 'object') {
    base.ui = {
      ...base.ui,
      ...raw.ui,
      expenseFilter: { ...base.ui.expenseFilter, ...(raw.ui.expenseFilter || {}) },
    };
  }
  if (raw.meta && typeof raw.meta === 'object') {
    base.meta = { ...base.meta, ...raw.meta };
  }
  return base;
}

function bumpNidFromState(state) {
  const pools = [
    state.income, state.expenses, state.assets, state.liabilities,
    state.debts, state.goals, state.expenseLog, state.expenseLibrary,
    state.cashApp?.stocks, state.cashApp?.activity,
  ];
  let max = _nid;
  for (const pool of pools) {
    if (!Array.isArray(pool)) continue;
    for (const x of pool) {
      const id = +x?.id || 0;
      if (id > max) max = id;
    }
  }
  _nid = max;
}

export function load() {
  let parsed = null;
  let source = null;
  try {
    const primary = localStorage.getItem(SK);
    if (primary) { parsed = JSON.parse(primary); source = SK; }
    else {
      for (const k of SK_OLD_KEYS) {
        const old = localStorage.getItem(k);
        if (old) { parsed = JSON.parse(old); source = k; break; }
      }
    }
  } catch (e) {
    console.warn('[eljefe-fin] load parse failed', e);
  }
  S = migrate(parsed);
  bumpNidFromState(S);
  if (source && source !== SK) {
    try {
      localStorage.setItem(SK, JSON.stringify(S));
      console.log('[eljefe-fin] migrated', source, '→', SK);
    } catch (e) { /* ignore */ }
  }
  runMonthRolloverIfNeeded(S);
}

export function save() {
  try {
    localStorage.setItem(SK, JSON.stringify(S));
    snapshotToday(S);
    const e = document.getElementById('ts');
    if (e) e.textContent = 'Saved ' + new Date().toLocaleTimeString();
  } catch (e) {
    console.warn('[eljefe-fin] save failed', e);
  }
}

export function replaceState(newRaw) {
  S = migrate(newRaw);
  bumpNidFromState(S);
  save();
  fireRender();
}

export function go() {
  fireRender();
  save();
}

// Totals derived from current state. Computed here (not in history.js) so
// tab renderers can share them without loading snapshots.
export function totals() {
  const inB = S.income.reduce((s, i) => s + (+i.budgeted || 0), 0);
  const inR = S.income.reduce((s, i) => s + (+i.received || 0), 0);
  const exB = S.expenses.reduce((s, i) => s + (+i.budgeted || 0), 0);
  const exS = S.expenses.reduce((s, i) => s + (+i.spent || 0), 0);
  const ta = S.assets.reduce((s, a) => s + (+a.amount || 0), 0);
  const tl = S.liabilities.reduce((s, l) => s + (+l.amount || 0), 0);
  const miC = Object.entries(S.moveIn)
    .filter(([k]) => k !== 'saved')
    .reduce((s, [, v]) => s + (+v || 0), 0);
  return {
    inB, inR, exB, exS,
    surp: inB - exB,
    nw: ta - tl,
    ta, tl,
    miC,
    miG: miC - (+S.moveIn.saved || 0),
  };
}
