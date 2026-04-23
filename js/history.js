import { todayISO, monthISO } from './utils.js';

export const HK = 'eljefe-fin-history-v1';
const HISTORY_CAP = 1200;

export function getHistory() {
  try {
    const raw = localStorage.getItem(HK);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function computeEntry(S) {
  const totalAssets = S.assets.reduce((s, a) => s + (+a.amount || 0), 0);
  const totalLiabilities = S.liabilities.reduce((s, l) => s + (+l.amount || 0), 0);
  const netWorth = totalAssets - totalLiabilities;
  const totalDebt = S.debts.reduce((s, d) => s + (+d.balance || 0), 0);
  const monthBudget = S.expenses.reduce((s, e) => s + (+e.budgeted || 0), 0);
  const monthSpent = S.expenses.reduce((s, e) => s + (+e.spent || 0), 0);
  const inB = S.income.reduce((s, i) => s + (+i.budgeted || 0), 0);
  const monthSurplus = inB - monthBudget;
  return {
    date: todayISO(),
    netWorth,
    totalDebt,
    totalAssets,
    totalLiabilities,
    monthBudget,
    monthSpent,
    monthSurplus,
  };
}

// Append or replace today's snapshot. One entry per calendar day; latest wins.
export function snapshotToday(S) {
  try {
    const entry = computeEntry(S);
    const hist = getHistory();
    const last = hist[hist.length - 1];
    if (last && last.date === entry.date) hist[hist.length - 1] = entry;
    else hist.push(entry);
    if (hist.length > HISTORY_CAP) hist.splice(0, hist.length - HISTORY_CAP);
    localStorage.setItem(HK, JSON.stringify(hist));
    return entry;
  } catch (e) {
    console.warn('[eljefe-fin] snapshot failed', e);
    return null;
  }
}

export function seedHistoryIfEmpty(S) {
  const hist = getHistory();
  if (hist.length === 0) snapshotToday(S);
}

// Returns the last N days of history, filling gaps with the most recent
// known entry so charts look contiguous even when the user skips days.
export function historyLastNDays(n) {
  const hist = getHistory();
  if (!hist.length) return [];
  const byDate = new Map(hist.map(h => [h.date, h]));
  const out = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  let last = null;
  // Find first history date within the window, or use earliest.
  const start = new Date(today);
  start.setDate(start.getDate() - (n - 1));
  // Seed `last` with any history entry before the window.
  for (const h of hist) {
    if (new Date(h.date + 'T00:00:00') < start) last = h;
    else break;
  }
  for (let i = 0; i < n; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    const iso = d.toISOString().slice(0, 10);
    if (byDate.has(iso)) last = byDate.get(iso);
    out.push({ date: iso, entry: last });
  }
  return out;
}

export function clearHistory() {
  try { localStorage.removeItem(HK); } catch { /* ignore */ }
}

// If the calendar month has rolled over since the last time we saw the app,
// snapshot the previous month's per-category spend into S.history.monthlySpent
// and zero out the `spent` columns so the new month starts clean.
export function runMonthRolloverIfNeeded(S) {
  const now = monthISO();
  const last = S.meta?.lastRolloverMonth || '';
  if (!last) {
    S.meta = S.meta || {};
    S.meta.lastRolloverMonth = now;
    return false;
  }
  if (last === now) return false;
  const byCat = {};
  let total = 0;
  for (const e of S.expenses) {
    const v = +e.spent || 0;
    if (v <= 0) continue;
    total += v;
    byCat[e.cat || 'Other'] = (byCat[e.cat || 'Other'] || 0) + v;
  }
  S.history = S.history || { monthlySpent: {} };
  S.history.monthlySpent = S.history.monthlySpent || {};
  S.history.monthlySpent[last] = { total, byCategory: byCat };
  for (const e of S.expenses) e.spent = 0;
  S.meta.lastRolloverMonth = now;
  return true;
}
