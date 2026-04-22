const { getPlaidClient } = require('../lib/plaid-client');
const { requireSoloAuth } = require('../lib/auth');
const { readPlaidSession } = require('../lib/crypto-session');

const MAX_PAGES = 25;
const MAX_ROWS = 400;

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  if (!requireSoloAuth(req, res)) return;
  const session = readPlaidSession(req);
  if (!session?.access_token) {
    return res.status(400).json({ error: 'not_linked', message: 'Connect a bank first.' });
  }
  try {
    const client = getPlaidClient();
    let cursor = undefined;
    let pages = 0;
    const added = [];
    while (pages < MAX_PAGES && added.length < MAX_ROWS) {
      const sync = await client.transactionsSync({
        access_token: session.access_token,
        cursor,
        count: 200,
      });
      const batch = sync.data.added || [];
      for (const t of batch) {
        added.push(t);
        if (added.length >= MAX_ROWS) break;
      }
      if (!sync.data.has_more) break;
      cursor = sync.data.next_cursor;
      pages += 1;
    }
    added.sort((a, b) => String(b.date).localeCompare(String(a.date)) || (b.transaction_id || '').localeCompare(a.transaction_id || ''));
    const slice = added.slice(0, 150).map((t) => ({
      transaction_id: t.transaction_id,
      date: t.date,
      name: t.name,
      merchant_name: t.merchant_name,
      amount: t.amount,
      pending: t.pending,
      category: t.personal_finance_category?.primary || (t.category && t.category[0]) || null,
      account_id: t.account_id,
    }));
    return res.status(200).json({ transactions: slice, total_fetched: added.length });
  } catch (e) {
    const msg = e.response?.data || e.message || String(e);
    console.error('transactionsSync', msg);
    return res.status(500).json({ error: 'transactions_failed', detail: msg });
  }
};
