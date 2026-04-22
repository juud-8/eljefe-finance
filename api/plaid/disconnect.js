const { getPlaidClient } = require('../lib/plaid-client');
const { requireSoloAuth } = require('../lib/auth');
const { readPlaidSession, clearPlaidSessionCookie } = require('../lib/crypto-session');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  if (!requireSoloAuth(req, res)) return;
  const session = readPlaidSession(req);
  clearPlaidSessionCookie(res, req);
  if (!session?.access_token) {
    return res.status(200).json({ ok: true, removed: false });
  }
  try {
    const client = getPlaidClient();
    await client.itemRemove({ access_token: session.access_token });
  } catch (e) {
    console.warn('itemRemove', e.response?.data || e.message);
  }
  return res.status(200).json({ ok: true, removed: true });
};
