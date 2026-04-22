function getBearer(req) {
  const h = req.headers.authorization || '';
  const m = /^Bearer\s+(.+)$/i.exec(h);
  return m ? m[1].trim() : '';
}

function requireSoloAuth(req, res) {
  const secret = process.env.FINANCE_SOLO_SECRET;
  if (!secret) {
    res.status(500).json({
      error: 'missing_FINANCE_SOLO_SECRET',
      message: 'Pick a long random passphrase and set FINANCE_SOLO_SECRET (Vercel env or .env.local). Same value is used in the Bank tab.',
    });
    return false;
  }
  if (getBearer(req) !== secret) {
    res.status(401).json({ error: 'Unauthorized' });
    return false;
  }
  return true;
}

module.exports = { requireSoloAuth, getBearer };
