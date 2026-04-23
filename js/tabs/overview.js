import { $$, pc, esc, daysUntil } from '../utils.js';
import { sparkline } from '../charts.js';

export function renderOverview(S, t) {
  const days = Math.max(0, daysUntil('2026-05-01'));
  const bp = pc(t.exS, t.exB);
  const kpis = document.getElementById('kpis');
  if (!kpis) return;
  kpis.innerHTML = `
    <div class="kc">
      <div class="kl">Net worth</div>
      <div class="kv" style="color:${t.nw >= 0 ? 'var(--green)' : 'var(--red)'}">${$$(t.nw)}</div>
      <div class="ks">${$$(t.ta)} assets · ${$$(t.tl)} debt</div>
      ${sparkline('netWorth', 90)}
    </div>
    <div class="kc">
      <div class="kl">Monthly surplus</div>
      <div class="kv" style="color:${t.surp >= 0 ? 'var(--green)' : 'var(--red)'}">${$$(t.surp)}</div>
      <div class="ks">${$$(t.inB)} in · ${$$(t.exB)} out</div>
      ${sparkline('monthSurplus', 90)}
    </div>
    <div class="kc">
      <div class="kl">Move-in gap</div>
      <div class="kv" style="color:${t.miG <= 0 ? 'var(--green)' : 'var(--red)'}">${t.miG <= 0 ? 'Ready' : $$(t.miG)}</div>
      <div class="ks">${days}d to May 1</div>
    </div>
    <div class="kc">
      <div class="kl">Total debt</div>
      <div class="kv" style="color:var(--red)">${$$(S.debts.reduce((s, d) => s + (+d.balance || 0), 0))}</div>
      <div class="ks">Budget used ${bp}%</div>
      ${sparkline('totalDebt', 90)}
    </div>
  `;

  const mx = Math.max(t.inB, t.exB, 1);
  const cfBars = document.getElementById('cfbars');
  if (cfBars) {
    cfBars.innerHTML = [
      { l: 'Income', v: t.inB, c: 'var(--green)' },
      { l: 'Expenses', v: t.exB, c: 'var(--red)' },
      { l: t.surp >= 0 ? 'Surplus' : 'Deficit', v: Math.abs(t.surp), c: t.surp >= 0 ? 'var(--gold)' : 'var(--red)' },
    ].map(b => `
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px">
        <div style="font-size:12px;color:var(--muted);width:58px">${esc(b.l)}</div>
        <div style="flex:1;background:var(--border);border-radius:3px;height:7px">
          <div style="width:${pc(b.v, mx)}%;background:${b.c};height:100%;border-radius:3px"></div>
        </div>
        <div style="font-family:var(--mono);font-size:12px;color:${b.c};width:66px;text-align:right">${$$(b.v)}</div>
      </div>
    `).join('');
  }

  const top = [...S.expenses].filter(e => e.budgeted > 0).sort((a, b) => b.budgeted - a.budgeted).slice(0, 5);
  const topEl = document.getElementById('topexp');
  if (topEl) {
    topEl.innerHTML = top.length
      ? top.map(e => `
          <div style="display:flex;justify-content:space-between;margin-bottom:9px">
            <span style="font-size:12px;color:var(--text)">${esc(e.name)}</span>
            <span style="font-family:var(--mono);font-size:12px;color:var(--muted)">${$$(e.budgeted)}</span>
          </div>`).join('')
      : '<span style="font-size:12px;color:var(--muted)">Fill in the budget to see breakdown</span>';
  }

  const ag = S.goals.find(g => (g.name || '').toLowerCase().includes('agentace'));
  const mrr = ag ? ag.current : 0;
  const acc = document.getElementById('accbar');
  if (acc) {
    acc.innerHTML = `
      <div class="acc-bar">
        <div>
          <div style="font-size:10px;font-weight:500;color:var(--gold);text-transform:uppercase;letter-spacing:.08em;margin-bottom:3px">El Jefé rule</div>
          <div style="font-size:12px;color:var(--muted)">$10K MRR × 2 consecutive months → leave the day job</div>
        </div>
        <div style="text-align:right;flex-shrink:0;margin-left:12px">
          <div style="font-size:10px;color:var(--muted);margin-bottom:2px">Current MRR</div>
          <div style="font-size:18px;font-weight:700;font-family:var(--mono);color:var(--gold)">${$$(mrr)}</div>
        </div>
      </div>
    `;
  }
}
