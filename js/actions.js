import { S, go, nextId } from './state.js';
import { toast, todayISO } from './utils.js';
import { setExpensePrefill } from './tabs/spending.js';
import { setExtraPayment } from './tabs/debt.js';

// Match an expense log entry to a budget row. Prefer exact name match in
// the same category, then any row in the category. Returns the budget row
// or null if nothing matches (in which case we don't touch the budget).
function findBudgetRowForLog(entry) {
  if (!entry || !entry.cat) return null;
  const byName = S.expenses.find(e => e.cat === entry.cat && e.name && entry.name && e.name.trim().toLowerCase() === entry.name.trim().toLowerCase());
  if (byName) return byName;
  const sameCat = S.expenses.filter(e => e.cat === entry.cat);
  if (sameCat.length === 1) return sameCat[0];
  // Prefer a row in the category that already has spend on it (the "running total" row).
  const active = sameCat.find(e => (+e.spent || 0) > 0);
  return active || null;
}

function adjustBudgetSpent(entry, delta) {
  const row = findBudgetRowForLog(entry);
  if (!row) return;
  const next = Math.max(0, (+row.spent || 0) + delta);
  row.spent = Math.round(next * 100) / 100;
}

function sanitizePositiveNumber(v) {
  const n = +v;
  if (!isFinite(n) || n < 0) return 0;
  return n;
}

// ── Generic list ops ────────────────────────────────────────────────────
export function upf(sec, id, field, val) {
  const item = S[sec]?.find(x => x.id === id);
  if (!item) return;
  if (field === 'budgeted' || field === 'received' || field === 'spent') {
    item[field] = sanitizePositiveNumber(val);
  } else {
    item[field] = val;
  }
  go();
}
export function addRow(sec) {
  const id = nextId();
  if (sec === 'income') S.income.push({ id, name: 'New source', budgeted: 0, received: 0 });
  else if (sec === 'expenses') S.expenses.push({ id, name: 'New expense', cat: 'Other', budgeted: 0, spent: 0 });
  else if (sec === 'assets') S.assets.push({ id, name: 'New asset', amount: 0, lastUpdated: '' });
  else if (sec === 'liabilities') S.liabilities.push({ id, name: 'New liability', amount: 0, lastUpdated: '' });
  go();
}
export function delRow(sec, id) {
  S[sec] = S[sec].filter(i => i.id !== id);
  go();
}

// ── Assets/Liabilities ──────────────────────────────────────────────────
export function upAL(sec, id, field, val) {
  const i = S[sec]?.find(x => x.id === id);
  if (!i) return;
  if (field === 'amount') i[field] = sanitizePositiveNumber(val);
  else i[field] = val;
  if (field === 'amount') i.lastUpdated = todayISO();
  go();
}

// ── Goals ───────────────────────────────────────────────────────────────
export function upGoal(id, field, val) {
  const g = S.goals.find(x => x.id === id);
  if (!g) return;
  if (field === 'target' || field === 'current') g[field] = sanitizePositiveNumber(val);
  else g[field] = val;
  go();
}
export function addGoal() { S.goals.push({ id: nextId(), name: 'New goal', target: 0, current: 0 }); go(); }
export function delGoal(id) { S.goals = S.goals.filter(g => g.id !== id); go(); }

// ── Move-in ─────────────────────────────────────────────────────────────
export function upMI(k, v) { S.moveIn[k] = sanitizePositiveNumber(v); go(); }

// ── Debts ───────────────────────────────────────────────────────────────
export function upDebt(id, field, val) {
  const d = S.debts.find(x => x.id === id);
  if (!d) return;
  if (field === 'balance' || field === 'apr' || field === 'minPayment') {
    d[field] = sanitizePositiveNumber(val);
  } else {
    d[field] = val;
  }
  go();
}
export function addDebt() {
  S.debts.push({ id: nextId(), name: 'New debt', type: 'Other', balance: 0, apr: 0, minPayment: 0, dueDate: '' });
  go();
}
export function delDebt(id) { S.debts = S.debts.filter(x => x.id !== id); go(); }

export function updateSimExtra(v) {
  setExtraPayment(+v || 0);
  go();
}

// ── Cash App ────────────────────────────────────────────────────────────
export function upCA(field, val) { S.cashApp[field] = sanitizePositiveNumber(val); go(); }
export function upCABtc(field, val) { S.cashApp.btc[field] = sanitizePositiveNumber(val); go(); }
export function upCABorrow(field, val) {
  if (field === 'balance' || field === 'originalAmount' || field === 'apr' || field === 'feePct' || field === 'minPayment') {
    S.cashApp.borrow[field] = sanitizePositiveNumber(val);
  } else {
    S.cashApp.borrow[field] = val;
  }
  go();
}
export function addCAStock() {
  S.cashApp.stocks.push({ id: nextId(), ticker: '', name: '', shares: 0, price: 0 });
  go();
}
export function upCAStock(id, field, val) {
  const s = S.cashApp.stocks.find(x => x.id === id);
  if (!s) return;
  if (field === 'shares' || field === 'price') s[field] = sanitizePositiveNumber(val);
  else s[field] = val;
  go();
}
export function delCAStock(id) { S.cashApp.stocks = S.cashApp.stocks.filter(x => x.id !== id); go(); }
export function logCAActivity() {
  const dEl = document.getElementById('ca-act-date');
  const nEl = document.getElementById('ca-act-name');
  const dirEl = document.getElementById('ca-act-dir');
  const amtEl = document.getElementById('ca-act-amt');
  if (!dEl || !nEl || !dirEl || !amtEl) return;
  const date = dEl.value || todayISO();
  const name = nEl.value.trim();
  const direction = dirEl.value === 'in' ? 'in' : 'out';
  const amount = sanitizePositiveNumber(amtEl.value);
  if (amount <= 0) { toast('Enter a positive amount', 'error'); return; }
  S.cashApp.activity.push({ id: nextId(), date, name, direction, amount });
  nEl.value = '';
  amtEl.value = '';
  go();
}
export function delCAActivity(id) { S.cashApp.activity = S.cashApp.activity.filter(x => x.id !== id); go(); }

// ── Expense log & library ───────────────────────────────────────────────
export function logExpense() {
  const dateEl = document.getElementById('exp-date');
  const nameEl = document.getElementById('exp-name');
  const catEl = document.getElementById('exp-cat');
  const amtEl = document.getElementById('exp-amt');
  if (!dateEl || !nameEl || !catEl || !amtEl) return;
  const date = dateEl.value || todayISO();
  const name = nameEl.value.trim();
  const cat = catEl.value || 'Other';
  const amount = sanitizePositiveNumber(amtEl.value);
  if (!name) { toast('Add a short description', 'error'); return; }
  if (amount <= 0) { toast('Enter a positive amount', 'error'); return; }
  const entry = { id: nextId(), date, name, cat, amount };
  S.expenseLog.push(entry);
  adjustBudgetSpent(entry, +amount);
  nameEl.value = '';
  amtEl.value = '';
  toast('Logged ' + name, 'success');
  go();
}
export function saveExpenseToLibrary() {
  const nameEl = document.getElementById('exp-name');
  const catEl = document.getElementById('exp-cat');
  const amtEl = document.getElementById('exp-amt');
  if (!nameEl || !catEl || !amtEl) return;
  const name = nameEl.value.trim();
  const cat = catEl.value || 'Other';
  const amount = sanitizePositiveNumber(amtEl.value);
  if (!name) { toast('Add a description first', 'error'); return; }
  S.expenseLibrary.push({ id: nextId(), name, cat, amount: amount > 0 ? amount : 0 });
  toast('Saved to library', 'success');
  go();
}
export function useExpenseLib(id) {
  const t = S.expenseLibrary.find(x => x.id === id);
  if (!t) return;
  setExpensePrefill({ name: t.name, cat: t.cat, amount: t.amount });
  go();
}
export function delExpenseLibItem(id) { S.expenseLibrary = S.expenseLibrary.filter(x => x.id !== id); go(); }
export function delExpenseLogRow(id) {
  const entry = S.expenseLog.find(x => x.id === id);
  if (entry) adjustBudgetSpent(entry, -(+entry.amount || 0));
  S.expenseLog = S.expenseLog.filter(x => x.id !== id);
  go();
}

export function updateExpenseFilter(field, val) {
  if (!S.ui) S.ui = { expenseFilter: {} };
  if (!S.ui.expenseFilter) S.ui.expenseFilter = {};
  S.ui.expenseFilter[field] = val;
  go();
}
export function clearExpenseFilter() {
  if (S.ui) S.ui.expenseFilter = { cat: '', from: '', to: '', min: '' };
  go();
}
