const { getPlaidClient } = require('../lib/plaid-client');
const { requireSoloAuth } = require('../lib/auth');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  if (!requireSoloAuth(req, res)) return;
  try {
    const client = getPlaidClient();
    const create = await client.linkTokenCreate({
      user: { client_user_id: 'eljefe-solo' },
      client_name: 'El Jefé Finance',
      products: ['transactions'],
      country_codes: ['US'],
      language: 'en',
    });
    return res.status(200).json({ link_token: create.data.link_token });
  } catch (e) {
    const msg = e.response?.data || e.message || String(e);
    console.error('linkTokenCreate', msg);
    return res.status(500).json({ error: 'link_token_failed', detail: msg });
  }
};
