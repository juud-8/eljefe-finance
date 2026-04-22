const crypto = require('crypto');

const COOKIE = 'ej_plaid';

function deriveKey(secret) {
  return crypto.createHash('sha256').update(String(secret), 'utf8').digest();
}

function encryptPayload(secret, obj) {
  const key = deriveKey(secret);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const plain = Buffer.from(JSON.stringify(obj), 'utf8');
  const enc = Buffer.concat([cipher.update(plain), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString('base64url');
}

function decryptPayload(secret, token) {
  if (!token) return null;
  try {
    const raw = Buffer.from(token, 'base64url');
    const iv = raw.subarray(0, 12);
    const tag = raw.subarray(12, 28);
    const data = raw.subarray(28);
    const key = deriveKey(secret);
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);
    const dec = Buffer.concat([decipher.update(data), decipher.final()]);
    return JSON.parse(dec.toString('utf8'));
  } catch {
    return null;
  }
}

function parseCookies(header) {
  const out = {};
  if (!header || typeof header !== 'string') return out;
  header.split(';').forEach((part) => {
    const idx = part.indexOf('=');
    if (idx === -1) return;
    const k = part.slice(0, idx).trim();
    const v = part.slice(idx + 1).trim();
    try {
      out[k] = decodeURIComponent(v);
    } catch {
      out[k] = v;
    }
  });
  return out;
}

function readPlaidSession(req) {
  const secret = process.env.FINANCE_SOLO_SECRET;
  if (!secret) return null;
  const cookies = parseCookies(req.headers.cookie || '');
  const raw = cookies[COOKIE];
  if (!raw) return null;
  return decryptPayload(secret, raw);
}

function isHttpsRequest(req) {
  if (!req || !req.headers) return false;
  const xf = req.headers['x-forwarded-proto'];
  if (typeof xf === 'string' && xf.split(',')[0].trim() === 'https') return true;
  if (req.connection && req.connection.encrypted) return true;
  return false;
}

function setPlaidSessionCookie(res, secret, payload, req) {
  const val = encryptPayload(secret, payload);
  const parts = [
    `${COOKIE}=${encodeURIComponent(val)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    'Max-Age=' + 60 * 60 * 24 * 365,
  ];
  if (isHttpsRequest(req)) parts.push('Secure');
  res.setHeader('Set-Cookie', parts.join('; '));
}

function clearPlaidSessionCookie(res, req) {
  const parts = [`${COOKIE}=`, 'Path=/', 'HttpOnly', 'SameSite=Lax', 'Max-Age=0'];
  if (req && isHttpsRequest(req)) parts.push('Secure');
  res.setHeader('Set-Cookie', parts.join('; '));
}

module.exports = {
  COOKIE,
  readPlaidSession,
  setPlaidSessionCookie,
  clearPlaidSessionCookie,
};
