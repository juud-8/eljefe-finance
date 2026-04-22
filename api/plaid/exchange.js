const { getPlaidClient } = require('../lib/plaid-client');
const { requireSoloAuth } = require('../lib/auth');
const { setPlaidSessionCookie } = require('../lib/crypto-session');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  if (!requireSoloAuth(req, res)) return;
  let body = req.body;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body || '{}');
    } catch {
      body = {};
    }
  }
  const public_token = body?.public_token;
  if (!public_token) {
    return res.status(400).json({ error: 'missing_public_token' });
  }
  const secret = process.env.FINANCE_SOLO_SECRET;
  try {
    const client = getPlaidClient();
    const ex = await client.itemPublicTokenExchange({ public_token });
    const access_token = ex.data.access_token;
    const item_id = ex.data.item_id;
    setPlaidSessionCookie(res, secret, { access_token, item_id }, req);
    return res.status(200).json({ ok: true, item_id });
  } catch (e) {
    const msg = e.response?.data || e.message || String(e);
    console.error('itemPublicTokenExchange', msg);
    return res.status(500).json({ error: 'exchange_failed', detail: msg });
  }
};
