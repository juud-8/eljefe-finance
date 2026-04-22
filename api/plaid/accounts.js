const { getPlaidClient } = require('../lib/plaid-client');
const { requireSoloAuth } = require('../lib/auth');
const { readPlaidSession } = require('../lib/crypto-session');

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
    const out = await client.accountsGet({ access_token: session.access_token });
    const accounts = (out.data.accounts || []).map((a) => ({
      account_id: a.account_id,
      name: a.name,
      official_name: a.official_name,
      mask: a.mask,
      type: a.type,
      subtype: a.subtype,
      balances: {
        available: a.balances?.available,
        current: a.balances?.current,
        iso_currency_code: a.balances?.iso_currency_code,
      },
    }));
    return res.status(200).json({ accounts });
  } catch (e) {
    const msg = e.response?.data || e.message || String(e);
    console.error('accountsGet', msg);
    return res.status(500).json({ error: 'accounts_failed', detail: msg });
  }
};
