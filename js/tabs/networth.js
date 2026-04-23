import { $$, esc, daysUntil } from '../utils.js';
import { sparkline } from '../charts.js';

function stalenessDays(iso) {
  if (!iso) return null;
  return -daysUntil(iso);
}

export function renderNetWorth(S, t) {
  const nwEl = document.getElementById('nwv');
  if (!nwEl) return;
  nwEl.textContent = $$(t.nw);
  nwEl.style.color = t.nw >= 0 ? 'var(--green)' : 'var(--red)';

  const spark = document.getElementById('nw-spark');
  if (spark) spark.innerHTML = sparkline('netWorth', 180, { height: 44 });

  const totA = document.getElementById('tot-a');
  const totL = document.getElementById('tot-l');
  if (totA) totA.textContent = $$(t.ta);
  if (totL) totL.textContent = $$(t.tl);

  const astTb = document.getElementById('ast-tb');
  if (astTb) {
    astTb.innerHTML = S.assets.map(a => {
      const days = stalenessDays(a.lastUpdated);
      const stale = days != null && days > 30;
      const hint = a.lastUpdated
        ? `<div style="font-size:10px;color:${stale ? 'var(--red)' : 'var(--muted2)'}">as of ${esc(a.lastUpdated)}${stale ? ' · stale' : ''}</div>`
        : '';
      return `<tr>
        <td>
          <input class="namei" data-fid="ast-${a.id}-name" value="${esc(a.name)}" onchange="upAL('assets',${a.id},'name',this.value)"/>
          ${hint}
        </td>
        <td class="r">
          <input class="ni" data-fid="ast-${a.id}-amount" type="number" inputmode="decimal" min="0" value="${a.amount || ''}" placeholder="0" onchange="upAL('assets',${a.id},'amount',+this.value||0)"/>
          <div><input type="date" class="ni" style="width:130px;font-size:10px;text-align:left;padding:1px 3px" data-fid="ast-${a.id}-updated" value="${esc(a.lastUpdated || '')}" onchange="upAL('assets',${a.id},'lastUpdated',this.value||'')"/></div>
        </td>
        <td><button class="db" onclick="delRow('assets',${a.id})" aria-label="Remove">×</button></td>
      </tr>`;
    }).join('');
  }

  const libTb = document.getElementById('lib-tb');
  if (libTb) {
    libTb.innerHTML = S.liabilities.map(l => {
      const days = stalenessDays(l.lastUpdated);
      const stale = days != null && days > 30;
      const hint = l.lastUpdated
        ? `<div style="font-size:10px;color:${stale ? 'var(--red)' : 'var(--muted2)'}">as of ${esc(l.lastUpdated)}${stale ? ' · stale' : ''}</div>`
        : '';
      return `<tr>
        <td>
          <input class="namei" data-fid="lib-${l.id}-name" value="${esc(l.name)}" onchange="upAL('liabilities',${l.id},'name',this.value)"/>
          ${hint}
        </td>
        <td class="r">
          <input class="ni" data-fid="lib-${l.id}-amount" type="number" inputmode="decimal" min="0" value="${l.amount || ''}" placeholder="0" onchange="upAL('liabilities',${l.id},'amount',+this.value||0)" style="color:var(--red)"/>
          <div><input type="date" class="ni" style="width:130px;font-size:10px;text-align:left;padding:1px 3px" data-fid="lib-${l.id}-updated" value="${esc(l.lastUpdated || '')}" onchange="upAL('liabilities',${l.id},'lastUpdated',this.value||'')"/></div>
        </td>
        <td><button class="db" onclick="delRow('liabilities',${l.id})" aria-label="Remove">×</button></td>
      </tr>`;
    }).join('');
  }
}
