import { $$, pc, esc, monthISO } from '../utils.js';

// Budget categories that are effectively required — used to auto-generate
// the "Still needed" banner instead of maintaining a hardcoded list.
const REQUIRED_FLAGS = [
  { test: e => /phone/i.test(e.name),          label: 'phone bill' },
  { test: e => /util|internet/i.test(e.name),  label: 'utilities / internet' },
  { test: e => /groceries/i.test(e.name),      label: 'groceries budget' },
  { test: e => /upstart/i.test(e.name),        label: 'Upstart APR' },
  { test: e => /SD6491589/i.test(e.name),      label: 'SD6491589 lender identity' },
  { test: e => /capital\s*one/i.test(e.name),  label: 'Capital One APR' },
];

function stillNeededNotes(S) {
  const notes = [];
  for (const row of REQUIRED_FLAGS) {
    const hit = S.expenses.find(e => row.test(e));
    if (hit && (+hit.budgeted || 0) === 0) notes.push(row.label);
  }
  const ag = S.goals.find(g => /agentace/i.test(g.name || ''));
  if (!ag || (+ag.current || 0) === 0) {
    // not a required budget field, skip
  }
  return notes;
}

function monthOverMonth(S) {
  const hist = S.history?.monthlySpent || {};
  const keys = Object.keys(hist).sort();
  if (!keys.length) return null;
  const lastKey = keys[keys.length - 1];
  const last = hist[lastKey];
  const thisMonth = monthISO();
  const currentByCat = {};
  for (const e of S.expenses) {
    const v = +e.spent || 0;
    if (!v) continue;
    currentByCat[e.cat || 'Other'] = (currentByCat[e.cat || 'Other'] || 0) + v;
  }
  return { lastKey, last, thisMonth, currentByCat };
}

export function renderBudget(S, t) {
  const inR = S.income.reduce((s, i) => s + (+i.received || 0), 0);
  const incTb = document.getElementById('inc-tb');
  const expTb = document.getElementById('exp-tb');
  if (!incTb || !expTb) return;

  // Still-needed banner (computed, not hardcoded).
  const banner = document.getElementById('budget-banner');
  if (banner) {
    const notes = stillNeededNotes(S);
    const ag = S.goals.find(g => /agentace/i.test(g.name || ''));
    const mrr = ag ? +ag.current || 0 : 0;
    const k401 = '401k at Millcraft — NOT enrolled. Enroll immediately to capture any employer match.';
    if (notes.length || mrr < 10000) {
      banner.style.display = '';
      banner.innerHTML = `
        ${notes.length ? `<div>⚡ Still needed: ${notes.join(', ')}.</div>` : ''}
        <div style="margin-top:${notes.length ? '6px' : '0'}"><strong>${k401}</strong></div>
      `;
    } else {
      banner.style.display = 'none';
    }
  }

  incTb.innerHTML = S.income.map(item => `
    <tr>
      <td><input class="namei" data-fid="inc-${item.id}-name" value="${esc(item.name)}" onchange="upf('income',${item.id},'name',this.value)"/></td>
      <td class="r"><input class="ni" data-fid="inc-${item.id}-budgeted" type="number" inputmode="decimal" min="0" value="${item.budgeted || ''}" placeholder="0" onchange="upf('income',${item.id},'budgeted',+this.value||0)"/></td>
      <td class="r"><input class="ni" data-fid="inc-${item.id}-received" type="number" inputmode="decimal" min="0" value="${item.received || ''}" placeholder="0" onchange="upf('income',${item.id},'received',+this.value||0)"/></td>
      <td><button class="db" onclick="delRow('income',${item.id})" aria-label="Remove">×</button></td>
    </tr>
  `).join('') + `
    <tr class="tot-row">
      <td style="color:var(--green)">Total</td>
      <td class="r" style="font-family:var(--mono);color:var(--green)">${$$(t.inB)}</td>
      <td class="r" style="font-family:var(--mono);color:var(--green)">${$$(inR)}</td>
      <td></td>
    </tr>`;

  expTb.innerHTML = S.expenses.map(item => {
    const ov = item.spent > item.budgeted && item.budgeted > 0;
    return `<tr>
      <td>
        <input class="namei" data-fid="exp-${item.id}-name" value="${esc(item.name)}" onchange="upf('expenses',${item.id},'name',this.value)" style="${ov ? 'color:var(--red)' : ''}"/>
        ${item.budgeted > 0 ? `<div class="pb"><div class="pf" style="width:${pc(item.spent, item.budgeted)}%;background:${ov ? 'var(--red)' : 'var(--blue)'}"></div></div>` : ''}
      </td>
      <td style="font-size:11px;color:var(--muted)">${esc(item.cat)}</td>
      <td class="r"><input class="ni" data-fid="exp-${item.id}-budgeted" type="number" inputmode="decimal" min="0" value="${item.budgeted || ''}" placeholder="0" onchange="upf('expenses',${item.id},'budgeted',+this.value||0)"/></td>
      <td class="r"><input class="ni" data-fid="exp-${item.id}-spent" type="number" inputmode="decimal" min="0" value="${item.spent || ''}" placeholder="0" onchange="upf('expenses',${item.id},'spent',+this.value||0)" style="${ov ? 'color:var(--red)' : ''}"/></td>
      <td><button class="db" onclick="delRow('expenses',${item.id})" aria-label="Remove">×</button></td>
    </tr>`;
  }).join('') + `
    <tr class="tot-row">
      <td style="color:var(--red)">Total</td><td></td>
      <td class="r" style="font-family:var(--mono);color:var(--red)">${$$(t.exB)}</td>
      <td class="r" style="font-family:var(--mono);color:var(--red)">${$$(t.exS)}</td>
      <td></td>
    </tr>`;

  const sEl = document.getElementById('surp');
  if (sEl) {
    sEl.textContent = $$(t.surp);
    sEl.style.color = t.surp >= 0 ? 'var(--green)' : 'var(--red)';
  }

  // Month-over-month comparison
  const momEl = document.getElementById('budget-mom');
  if (momEl) {
    const mom = monthOverMonth(S);
    if (!mom) {
      momEl.innerHTML = '<div style="font-size:12px;color:var(--muted2)">Month-over-month appears after the first rollover.</div>';
    } else {
      const cats = new Set([
        ...Object.keys(mom.last.byCategory || {}),
        ...Object.keys(mom.currentByCat || {}),
      ]);
      const rows = [...cats].sort().map(cat => {
        const prev = +((mom.last.byCategory || {})[cat]) || 0;
        const cur = +(mom.currentByCat[cat] || 0);
        const diff = cur - prev;
        const color = diff === 0 ? 'var(--muted)' : diff < 0 ? 'var(--green)' : 'var(--red)';
        const sign = diff > 0 ? '+' : '';
        return `<tr>
          <td style="font-size:12px">${esc(cat)}</td>
          <td class="r" style="font-family:var(--mono);font-size:12px;color:var(--muted)">${$$(prev)}</td>
          <td class="r" style="font-family:var(--mono);font-size:12px">${$$(cur)}</td>
          <td class="r" style="font-family:var(--mono);font-size:12px;color:${color}">${sign}${$$(diff)}</td>
        </tr>`;
      }).join('');
      momEl.innerHTML = `
        <div class="ct">Vs. last month (${esc(mom.lastKey)} → ${esc(mom.thisMonth)})</div>
        <table>
          <thead><tr><th>Category</th><th class="r">Last</th><th class="r">This</th><th class="r">Δ</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      `;
    }
  }
}
