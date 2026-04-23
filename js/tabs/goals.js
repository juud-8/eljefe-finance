import { $$, pc, esc } from '../utils.js';

export function renderGoals(S, t) {
  const host = document.getElementById('goals-list');
  if (!host) return;
  host.innerHTML = S.goals.map(g => {
    const p = pc(g.current, g.target);
    const barColor = p >= 100 ? 'var(--green)' : p >= 50 ? 'var(--gold)' : 'var(--blue)';
    const remaining = Math.max(0, (+g.target || 0) - (+g.current || 0));
    // Time-to-goal at current surplus (approximate).
    const surplus = +t.surp || 0;
    const etaLabel = remaining > 0 && surplus > 0
      ? `${Math.ceil(remaining / surplus)} mo at current surplus`
      : (remaining === 0 && (+g.target || 0) > 0 ? 'Done' : '—');
    return `<div class="gc">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
        <input class="namei" data-fid="goal-${g.id}-name" value="${esc(g.name)}" onchange="upGoal(${g.id},'name',this.value)" style="font-weight:500"/>
        <div style="display:flex;align-items:center;gap:8px">
          <span style="font-size:12px;font-family:var(--mono);color:var(--muted)">${p}%</span>
          <button class="db" onclick="delGoal(${g.id})" aria-label="Remove">×</button>
        </div>
      </div>
      <div class="pb" style="height:6px"><div class="pf" style="width:${p}%;background:${barColor}"></div></div>
      <div class="goal-inputs">
        <div><div class="gil">Target</div><input class="ni w110" data-fid="goal-${g.id}-target" type="number" inputmode="decimal" min="0" value="${g.target || ''}" placeholder="0" onchange="upGoal(${g.id},'target',+this.value||0)"/></div>
        <div><div class="gil">Current</div><input class="ni w110" data-fid="goal-${g.id}-current" type="number" inputmode="decimal" min="0" value="${g.current || ''}" placeholder="0" onchange="upGoal(${g.id},'current',+this.value||0)"/></div>
        <div><div class="gil">Remaining</div><div style="font-family:var(--mono);font-size:13px;color:var(--muted);padding-top:6px">${$$(remaining)}</div></div>
        <div><div class="gil">ETA</div><div style="font-size:12px;color:var(--muted);padding-top:6px">${etaLabel}</div></div>
      </div>
    </div>`;
  }).join('');
}
