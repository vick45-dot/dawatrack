// Owner-configurable settings, stored in the database per installation.
// The client configures payments in the app - no code or env editing.
const db = require('../db');

async function getAll() {
  const [rows] = await db.query('SELECT name, value FROM settings');
  const map = {};
  for (const r of rows) map[r.name] = r.value;
  return map;
}

async function setMany(obj) {
  const entries = Object.entries(obj);
  if (!entries.length) return;
  const values = entries.map(([n, v]) => [n, v == null ? '' : String(v)]);
  await db.query(
    'INSERT INTO settings (name, value) VALUES ? ON DUPLICATE KEY UPDATE value = VALUES(value)',
    [values]
  );
}

function bool(v) { return v === '1' || v === 'true'; }

// Which methods appear at the POS
function enabledMethods(s) {
  return ['cash', 'mpesa', 'card', 'paypal', 'applepay', 'bank', 'other']
    .filter(m => bool(s[`pay.${m}.enabled`] || '0'));
}

// Effective M-Pesa configuration: database first, environment as fallback,
// so old env-based deployments keep working.
function mpesaConfig(s) {
  const env = process.env;
  const kind = s['mpesa.kind'] || 'paybill';
  const shortcode = s['mpesa.shortcode'] || env.MPESA_SHORTCODE || '';
  const cfg = {
    kind, // paybill | till | pochi
    shortcode,
    partyB: s['mpesa.party_b'] || shortcode,
    pochiPhone: s['mpesa.pochi_phone'] || '',
    consumerKey: s['mpesa.consumer_key'] || env.MPESA_CONSUMER_KEY || '',
    consumerSecret: s['mpesa.consumer_secret'] || env.MPESA_CONSUMER_SECRET || '',
    passkey: s['mpesa.passkey'] || env.MPESA_PASSKEY || '',
    env: s['mpesa.env'] || env.MPESA_ENV || 'sandbox',
    callbackUrl:
      (s['app.public_url'] ? s['app.public_url'].replace(/\/+$/, '') + '/mpesa/callback' : '') ||
      env.MPESA_CALLBACK_URL || '',
    simulate: env.MPESA_SIMULATE === 'true' || bool(s['mpesa.simulate'] || '0'),
  };
  cfg.credentialed = !!(cfg.consumerKey && cfg.consumerSecret && cfg.shortcode && cfg.passkey && cfg.callbackUrl);
  // STK is possible for paybill/till when credentialed (or simulating). Never for pochi.
  cfg.stkReady = cfg.kind !== 'pochi' && (cfg.simulate || cfg.credentialed);
  return cfg;
}

module.exports = { getAll, setMany, bool, enabledMethods, mpesaConfig };
