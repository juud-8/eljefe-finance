import { S, load, save, go, subscribeRender } from './state.js';
import { render, renderAll } from './render.js';
import { wireBackupButtons } from './backup.js';
import * as actions from './actions.js';

function applyStoredTheme() {
  const pref = S.ui?.theme || 'auto';
  const root = document.documentElement;
  if (pref === 'auto') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', pref);
  const btn = document.getElementById('btn-theme');
  if (btn) btn.textContent = pref === 'auto' ? '☾ auto' : (pref === 'dark' ? '☾ dark' : '☀ light');
}

function cycleTheme() {
  if (!S.ui) S.ui = { theme: 'auto' };
  const order = ['auto', 'dark', 'light'];
  const current = S.ui.theme || 'auto';
  const next = order[(order.indexOf(current) + 1) % order.length];
  S.ui.theme = next;
  applyStoredTheme();
  save();
}

// Expose every mutation handler on `window` so the inline onclick/onchange
// attributes in the rendered markup find them at runtime. This preserves
// the single-file semantic while letting us modularize the source.
function exposeActions() {
  const w = window;
  const bind = (name, fn) => { w[name] = fn; };
  bind('upf', actions.upf);
  bind('addRow', actions.addRow);
  bind('delRow', actions.delRow);
  bind('upAL', actions.upAL);
  bind('upGoal', actions.upGoal);
  bind('addGoal', actions.addGoal);
  bind('delGoal', actions.delGoal);
  bind('upMI', actions.upMI);
  bind('upDebt', actions.upDebt);
  bind('addDebt', actions.addDebt);
  bind('delDebt', actions.delDebt);
  bind('upCA', actions.upCA);
  bind('upCABtc', actions.upCABtc);
  bind('upCABorrow', actions.upCABorrow);
  bind('addCAStock', actions.addCAStock);
  bind('upCAStock', actions.upCAStock);
  bind('delCAStock', actions.delCAStock);
  bind('logCAActivity', actions.logCAActivity);
  bind('delCAActivity', actions.delCAActivity);
  bind('logExpense', actions.logExpense);
  bind('saveExpenseToLibrary', actions.saveExpenseToLibrary);
  bind('useExpenseLib', actions.useExpenseLib);
  bind('delExpenseLibItem', actions.delExpenseLibItem);
  bind('delExpenseLogRow', actions.delExpenseLogRow);
  bind('updateExpenseFilter', actions.updateExpenseFilter);
  bind('clearExpenseFilter', actions.clearExpenseFilter);
  bind('updateSimExtra', actions.updateSimExtra);
  bind('st', switchTab);
  bind('cycleTheme', cycleTheme);
}

function switchTab(name) {
  document.querySelectorAll('.tc').forEach(e => e.classList.remove('on'));
  document.querySelectorAll('.tb').forEach(e => e.classList.remove('on'));
  const tc = document.getElementById('tab-' + name);
  const tb = document.querySelector(`.tb[data-tab="${name}"]`);
  if (tc) tc.classList.add('on');
  if (tb) tb.classList.add('on');
  // Render the newly active tab so it's up to date.
  render(S);
}

function wireKeyboardShortcuts() {
  const tabs = ['overview', 'budget', 'spending', 'networth', 'debt', 'cashapp', 'goals', 'movein'];
  window.addEventListener('keydown', (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const target = e.target;
    if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;
    if (/^[1-8]$/.test(e.key)) {
      const i = +e.key - 1;
      if (tabs[i]) { switchTab(tabs[i]); e.preventDefault(); }
    }
  });
}

function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  // Only register on https so dev over http://localhost keeps fresh code
  // (avoids the SW serving stale files during development).
  if (location.protocol !== 'https:') return;
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('service-worker.js').catch((e) => {
      console.warn('[eljefe-fin] SW registration failed', e);
    });
  });
}

function boot() {
  load();
  subscribeRender(render);
  exposeActions();
  wireBackupButtons();
  wireKeyboardShortcuts();
  applyStoredTheme();

  // Initial render: render every tab once so hidden tabs have current data
  // before the user first flips to them.
  renderAll(S);
  save();
  registerServiceWorker();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
