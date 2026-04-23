import { totals } from './state.js';
import { saveFocus, restoreFocus } from './utils.js';
import { renderOverview } from './tabs/overview.js';
import { renderBudget } from './tabs/budget.js';
import { renderSpending } from './tabs/spending.js';
import { renderNetWorth } from './tabs/networth.js';
import { renderDebt } from './tabs/debt.js';
import { renderCashApp } from './tabs/cashapp.js';
import { renderGoals } from './tabs/goals.js';
import { renderMoveIn } from './tabs/movein.js';

function getActiveTab() {
  const el = document.querySelector('.tc.on');
  if (!el) return 'overview';
  return el.id.replace('tab-', '');
}

// Render only the currently visible tab. This avoids ripping innerHTML on
// hidden tabs (cheaper) and preserves focus on inputs elsewhere.
export function render(S) {
  saveFocus();
  const t = totals();
  const active = getActiveTab();
  const map = {
    overview: renderOverview,
    budget: renderBudget,
    spending: renderSpending,
    networth: renderNetWorth,
    debt: renderDebt,
    cashapp: renderCashApp,
    goals: renderGoals,
    movein: renderMoveIn,
  };
  const fn = map[active] || renderOverview;
  fn(S, t);
  restoreFocus();
}

// Full render (used e.g. after import). Renders every tab so that hidden
// tabs show correct data when the user flips to them, even before any
// further interactions.
export function renderAll(S) {
  saveFocus();
  const t = totals();
  try { renderOverview(S, t); } catch (e) { console.error(e); }
  try { renderBudget(S, t); } catch (e) { console.error(e); }
  try { renderSpending(S, t); } catch (e) { console.error(e); }
  try { renderNetWorth(S, t); } catch (e) { console.error(e); }
  try { renderDebt(S, t); } catch (e) { console.error(e); }
  try { renderCashApp(S, t); } catch (e) { console.error(e); }
  try { renderGoals(S, t); } catch (e) { console.error(e); }
  try { renderMoveIn(S, t); } catch (e) { console.error(e); }
  restoreFocus();
}
