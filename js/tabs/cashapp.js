import { $$, esc, fmtMonths, debtPayoff, setIfNotFocused, todayISO } from '../utils.js';

export function caTotals(S) {
  const c = S.cashApp || {};
  const cash = +c.cashBalance || 0;
  const btcVal = (+(c.btc?.amount) || 0) * (+(c.btc?.priceUsd) || 0);
  const stkVal = (c.stocks || []).reduce((s, x) => s + ((+x.shares || 0) * (+x.price || 0)), 0);
  const owed = +(c.borrow?.balance) || 0;
  return { cash, btcVal, stkVal, owed, net: cash + btcVal + stkVal - owed };
}

// Cash App Borrow "flat fee" payoff: balance × (1 + feePct/100), paid in
// lump at dueDate. Returns {months, totalInterest, never} compatible with
// the APR payoff shape.
function flatFeePayoff(borrow) {
  const bal = +borrow.balance || 0;
  if (bal <= 0) return { months: 0, totalInterest: 0, never: false };
  const fee = bal * ((+borrow.feePct || 0) / 100);
  const min = +borrow.minPayment || 0;
  if (min <= 0 && !borrow.dueDate) return { months: Infinity, totalInterest: fee, never: true };
  if (min > 0) {
    const months = Math.max(1, Math.ceil((bal + fee) / min));
    return { months, totalInterest: fee, never: false };
  }
  // No min payment but a due date; approximate term as months until due.
  if (borrow.dueDate) {
    const target = new Date(borrow.dueDate + 'T00:00:00');
    const now = new Date();
    const months = Math.max(1, Math.ceil((target - now) / (86400000 * 30)));
    return { months, totalInterest: fee, never: false };
  }
  return { months: Infinity, totalInterest: fee, never: true };
}

export function renderCashApp(S) {
  const c = S.cashApp;
  if (!c) return;
  const kpis = document.getElementById('ca-kpis');
  if (!kpis) return;
  const t = caTotals(S);
  kpis.innerHTML = `
    <div class="kc"><div class="kl">Cash App net</div><div class="kv" style="color:${t.net >= 0 ? 'var(--green)' : 'var(--red)'}">${$$(t.net)}</div><div class="ks">Assets − Borrow</div></div>
    <div class="kc"><div class="kl">Cash</div><div class="kv">${$$(t.cash)}</div><div class="ks">Spendable</div></div>
    <div class="kc"><div class="kl">BTC + Stocks</div><div class="kv" style="color:var(--gold)">${$$(t.btcVal + t.stkVal)}</div><div class="ks">${$$(t.btcVal)} BTC · ${$$(t.stkVal)} stocks</div></div>
    <div class="kc"><div class="kl">Borrow owed</div><div class="kv" style="color:${t.owed > 0 ? 'var(--red)' : 'var(--text)'}">${$$(t.owed)}</div><div class="ks">Cash App loan</div></div>
  `;

  setIfNotFocused('ca-cash', c.cashBalance || '');
  setIfNotFocused('ca-btc-amt', c.btc.amount || '');
  setIfNotFocused('ca-btc-px', c.btc.priceUsd || '');
  const bVal = document.getElementById('ca-btc-val');
  if (bVal) bVal.textContent = $$(t.btcVal);

  const br = c.borrow;
  setIfNotFocused('ca-br-bal', br.balance || '');
  setIfNotFocused('ca-br-orig', br.originalAmount || '');
  setIfNotFocused('ca-br-apr', br.apr || '');
  setIfNotFocused('ca-br-fee', br.feePct || '');
  setIfNotFocused('ca-br-min', br.minPayment || '');
  setIfNotFocused('ca-br-due', br.dueDate || '');
  const kindEl = document.getElementById('ca-br-kind');
  if (kindEl && document.activeElement !== kindEl) kindEl.value = br.kind || 'flat';

  // Toggle fee-vs-apr field visibility based on kind.
  const feeRow = document.getElementById('ca-br-fee-row');
  const aprRow = document.getElementById('ca-br-apr-row');
  if (feeRow && aprRow) {
    const isFlat = (br.kind || 'flat') === 'flat';
    feeRow.style.display = isFlat ? '' : 'none';
    aprRow.style.display = isFlat ? 'none' : '';
  }

  const note = document.getElementById('ca-br-note');
  if (note) {
    if ((+br.balance || 0) > 0) {
      const p = (br.kind || 'flat') === 'flat' ? flatFeePayoff(br) : debtPayoff(br.balance, br.apr, br.minPayment);
      note.textContent = 'Payoff: ' + fmtMonths(p.months) + (isFinite(p.totalInterest) ? ' · cost ' + $$(p.totalInterest) : '');
    } else {
      note.textContent = '';
    }
  }

  const stb = document.getElementById('ca-stk-tb');
  if (stb) {
    stb.innerHTML = c.stocks.map(s => {
      const v = (+s.shares || 0) * (+s.price || 0);
      return `<tr>
        <td><input class="namei" data-fid="ca-stk-${s.id}-ticker" value="${esc(s.ticker || '')}" placeholder="AAPL" onchange="upCAStock(${s.id},'ticker',this.value.trim().toUpperCase())"/></td>
        <td><input class="namei" data-fid="ca-stk-${s.id}-name" value="${esc(s.name || '')}" placeholder="Name" onchange="upCAStock(${s.id},'name',this.value)"/></td>
        <td class="r"><input class="ni" data-fid="ca-stk-${s.id}-shares" type="number" inputmode="decimal" min="0" step="0.0001" value="${s.shares || ''}" placeholder="0" onchange="upCAStock(${s.id},'shares',+this.value||0)"/></td>
        <td class="r"><input class="ni" data-fid="ca-stk-${s.id}-price" type="number" inputmode="decimal" min="0" step="0.01" value="${s.price || ''}" placeholder="0" onchange="upCAStock(${s.id},'price',+this.value||0)"/></td>
        <td class="r" style="font-family:var(--mono);font-size:12px;color:var(--gold)">${$$(v)}</td>
        <td><button class="db" onclick="delCAStock(${s.id})" aria-label="Remove">×</button></td>
      </tr>`;
    }).join('');
  }

  const today = todayISO();
  const dEl = document.getElementById('ca-act-date');
  if (dEl && !dEl.value) dEl.value = today;
  const atb = document.getElementById('ca-act-tb');
  const aEmpty = document.getElementById('ca-act-empty');
  const sorted = [...c.activity].sort((a, b) => {
    if (a.date !== b.date) return b.date.localeCompare(a.date);
    return (b.id || 0) - (a.id || 0);
  });
  if (atb) {
    atb.innerHTML = sorted.map(a => {
      const col = a.direction === 'in' ? 'var(--green)' : 'var(--red)';
      const sign = a.direction === 'in' ? '+' : '−';
      const label = a.direction === 'in' ? 'Received' : 'Sent';
      return `<tr>
        <td style="font-family:var(--mono);font-size:12px;color:var(--muted)">${esc(a.date)}</td>
        <td>${esc(a.name || '')}</td>
        <td style="font-size:11px;color:${col}">${label}</td>
        <td class="r" style="font-family:var(--mono);color:${col}">${sign}${$$(Math.abs(+a.amount || 0))}</td>
        <td><button class="db" onclick="delCAActivity(${a.id})" aria-label="Remove">×</button></td>
      </tr>`;
    }).join('');
  }
  if (aEmpty) aEmpty.textContent = sorted.length ? '' : 'No entries yet.';
}
