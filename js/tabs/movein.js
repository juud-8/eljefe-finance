import { $$, pc, daysUntil } from '../utils.js';

export function renderMoveIn(S, t) {
  const days = Math.max(0, daysUntil('2026-05-01'));
  const dEl = document.getElementById('dct');
  if (dEl) dEl.textContent = days;
  const fields = [
    { k: 'securityDeposit', l: 'Security deposit' },
    { k: 'firstMonthRent',   l: 'First month rent' },
    { k: 'lastMonthRent',    l: 'Last month rent' },
    { k: 'movingCosts',      l: 'Moving costs' },
    { k: 'furniture',        l: 'Furniture' },
    { k: 'kitchenSetup',     l: 'Kitchen setup' },
    { k: 'misc',             l: 'Miscellaneous' },
    { k: 'saved',            l: 'Already saved', green: true },
  ];
  const items = document.getElementById('mi-items');
  if (items) {
    items.innerHTML = `
      <table><thead><tr><th>Item</th><th class="r">Amount</th></tr></thead>
      <tbody>${fields.map(f => `
        <tr>
          <td style="font-size:13px;${f.green ? 'color:var(--green);font-weight:500' : ''}">${f.l}</td>
          <td class="r"><input class="ni" data-fid="mi-${f.k}" type="number" inputmode="decimal" min="0" value="${S.moveIn[f.k] || ''}" placeholder="0"
            onchange="upMI('${f.k}',+this.value||0)" style="${f.green ? 'color:var(--green)' : ''}"/></td>
        </tr>`).join('')}</tbody></table>`;
  }
  const totEl = document.getElementById('mi-tot');
  if (totEl) totEl.textContent = $$(t.miC);
  const gEl = document.getElementById('mi-gap');
  if (gEl) {
    gEl.textContent = t.miG <= 0 ? '✓ Ready' : $$(t.miG);
    gEl.style.color = t.miG <= 0 ? 'var(--green)' : 'var(--red)';
  }
  const mp = pc(S.moveIn.saved, t.miC);
  const mpc = mp >= 100 ? 'var(--green)' : mp >= 50 ? 'var(--gold)' : 'var(--blue)';
  const status = document.getElementById('mi-status');
  if (status) {
    status.innerHTML = `
      ${[
        { l: 'Total cost',  v: $$(t.miC),                  ok: t.miC > 0 },
        { l: 'Saved',       v: $$(S.moveIn.saved),         ok: S.moveIn.saved > 0 },
        { l: 'Gap',         v: t.miG <= 0 ? '✓ Covered' : $$(t.miG), ok: t.miG <= 0 },
        { l: 'Days left',   v: days + ' days',             ok: days > 7 },
      ].map(r => `
        <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--border)">
          <span style="font-size:12px;color:var(--muted)">${r.l}</span>
          <span style="font-size:13px;font-family:var(--mono);color:${r.ok ? 'var(--green)' : 'var(--text)'}">${r.v}</span>
        </div>`).join('')}
      <div style="margin-top:12px">
        <div style="display:flex;justify-content:space-between;font-size:11px;color:var(--muted);margin-bottom:4px">
          <span>Readiness</span><span>${mp}%</span>
        </div>
        <div class="pb" style="height:7px"><div class="pf" style="width:${mp}%;background:${mpc}"></div></div>
      </div>`;
  }
}
