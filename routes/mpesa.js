// M-Pesa Daraja integration.
// - POST /mpesa/stk        (logged in)  : initiate STK push for a pending receipt
// - POST /mpesa/callback   (PUBLIC)     : Safaricom confirms payment -> sale records itself
// - POST /mpesa/simulate   (logged in)  : demo-mode stand-in for the callback
// - GET  /mpesa/status/:id (logged in)  : poll a receipt's status
//
// Configure via environment:
//   MPESA_ENV=sandbox|production
//   MPESA_CONSUMER_KEY / MPESA_CONSUMER_SECRET / MPESA_SHORTCODE / MPESA_PASSKEY
//   MPESA_CALLBACK_URL   e.g. https://your-app.onrender.com/mpesa/callback
//   MPESA_TRANSACTION_TYPE = CustomerPayBillOnline (paybill) | CustomerBuyGoodsOnline (till)
//   MPESA_SIMULATE=true  -> no Safaricom calls; a "simulate payment" flow completes receipts
const express = require('express');
const router = express.Router();
const db = require('../db');
const { requireLogin } = require('../middleware/auth');

const SIMULATE = process.env.MPESA_SIMULATE === 'true';
const CONFIGURED = !!(process.env.MPESA_CONSUMER_KEY && process.env.MPESA_CONSUMER_SECRET &&
  process.env.MPESA_SHORTCODE && process.env.MPESA_PASSKEY && process.env.MPESA_CALLBACK_URL);
const BASE = process.env.MPESA_ENV === 'production'
  ? 'https://api.safaricom.co.ke' : 'https://sandbox.safaricom.co.ke';

function normalizePhone(raw) {
  const p = String(raw || '').replace(/[\s+-]/g, '');
  if (/^254[17]\d{8}$/.test(p)) return p;
  if (/^0[17]\d{8}$/.test(p)) return '254' + p.slice(1);
  return null;
}

async function darajaToken() {
  const auth = Buffer.from(
    `${process.env.MPESA_CONSUMER_KEY}:${process.env.MPESA_CONSUMER_SECRET}`
  ).toString('base64');
  const res = await fetch(`${BASE}/oauth/v1/generate?grant_type=client_credentials`, {
    headers: { Authorization: `Basic ${auth}` },
  });
  if (!res.ok) throw new Error('M-Pesa auth failed: ' + res.status);
  return (await res.json()).access_token;
}

// Turn a paid pending receipt into real sales rows (stock re-checked here).
// This is THE auto-record step: called by the Safaricom callback (or simulator).
async function finalizeReceipt(receiptId, mpesaRef) {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const [[receipt]] = await conn.query(
      "SELECT * FROM receipts WHERE id = ? AND status = 'pending' FOR UPDATE", [receiptId]);
    if (!receipt) { await conn.rollback(); return { ok: false, reason: 'not pending' }; }

    const [items] = await conn.query(
      'SELECT * FROM receipt_items WHERE receipt_id = ?', [receiptId]);

    for (const it of items) {
      await conn.query('SELECT id FROM products WHERE id = ? FOR UPDATE', [it.product_id]);
      const [[pos]] = await conn.query(
        `SELECT
          COALESCE((SELECT SUM(quantity) FROM purchases WHERE product_id = ?), 0) -
          COALESCE((SELECT SUM(quantity) FROM sales     WHERE product_id = ?), 0) AS on_hand,
          COALESCE((SELECT SUM(quantity * buying_price) / SUM(quantity)
                    FROM purchases WHERE product_id = ?), 0) AS avg_cost`,
        [it.product_id, it.product_id, it.product_id]);
      if (pos.on_hand < it.quantity) {
        await conn.query("UPDATE receipts SET status = 'failed' WHERE id = ?", [receiptId]);
        await conn.commit();
        return { ok: false, reason: 'out of stock at confirmation' };
      }
      await conn.query(
        'INSERT INTO sales (product_id, user_id, receipt_id, quantity, selling_price, cost_price) VALUES (?, ?, ?, ?, ?, ?)',
        [it.product_id, receipt.user_id, receiptId, it.quantity, it.unit_price,
         Number(pos.avg_cost).toFixed(2)]);
    }
    await conn.query(
      "UPDATE receipts SET status = 'paid', paid_at = NOW(), payment_ref = ? WHERE id = ?",
      [mpesaRef || null, receiptId]);
    await conn.commit();
    return { ok: true };
  } catch (err) {
    await conn.rollback().catch(() => {});
    throw err;
  } finally { conn.release(); }
}

// Initiate STK push for a pending receipt. Returns { ok, msg }.
async function initiateStk(receiptId) {
  const [[receipt]] = await db.query(
    "SELECT * FROM receipts WHERE id = ? AND status = 'pending' AND payment_method = 'mpesa'",
    [receiptId]);
  if (!receipt) return { ok: false, msg: 'Receipt not found or already handled' };
  const phone = normalizePhone(receipt.customer_phone);
  if (!phone) return { ok: false, msg: 'Invalid phone number' };

  if (SIMULATE || !CONFIGURED) {
    await db.query('UPDATE receipts SET checkout_request_id = ? WHERE id = ?',
      ['SIM-' + receiptId + '-' + Date.now(), receiptId]);
    return { ok: true, msg: 'STK push sent (simulation) - use Simulate payment to complete' };
  }

  const token = await darajaToken();
  const ts = new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14);
  const password = Buffer.from(
    process.env.MPESA_SHORTCODE + process.env.MPESA_PASSKEY + ts).toString('base64');
  const payload = {
    BusinessShortCode: process.env.MPESA_SHORTCODE,
    Password: password,
    Timestamp: ts,
    TransactionType: process.env.MPESA_TRANSACTION_TYPE || 'CustomerPayBillOnline',
    Amount: Math.max(1, Math.round(Number(receipt.total))),
    PartyA: phone,
    PartyB: process.env.MPESA_SHORTCODE,
    PhoneNumber: phone,
    CallBackURL: process.env.MPESA_CALLBACK_URL,
    AccountReference: 'DawaTrack-' + receiptId,
    TransactionDesc: 'Chemist purchase',
  };
  const resp = await fetch(`${BASE}/mpesa/stkpush/v1/processrequest`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await resp.json();
  if (data.CheckoutRequestID) {
    await db.query('UPDATE receipts SET checkout_request_id = ? WHERE id = ?',
      [data.CheckoutRequestID, receiptId]);
    return { ok: true, msg: 'STK push sent - ask customer to enter PIN' };
  }
  return { ok: false, msg: 'STK failed: ' + (data.errorMessage || 'unknown') };
}

// Re-send STK for a pending receipt (button on the sales page)
router.post('/stk', requireLogin, async (req, res, next) => {
  try {
    const r = await initiateStk(Number(req.body.receipt_id));
    res.redirect('/sales?msg=' + encodeURIComponent(r.msg));
  } catch (err) { next(err); }
});

// PUBLIC: Safaricom posts payment results here. The sale records itself.
router.post('/callback', express.json({ limit: '100kb' }), async (req, res) => {
  try {
    const cb = req.body && req.body.Body && req.body.Body.stkCallback;
    if (!cb) return res.json({ ResultCode: 0, ResultDesc: 'Accepted' });
    const [[receipt]] = await db.query(
      'SELECT id FROM receipts WHERE checkout_request_id = ?', [cb.CheckoutRequestID]);
    if (receipt) {
      if (cb.ResultCode === 0) {
        const items = (cb.CallbackMetadata && cb.CallbackMetadata.Item) || [];
        const ref = (items.find(i => i.Name === 'MpesaReceiptNumber') || {}).Value || null;
        await finalizeReceipt(receipt.id, ref);
      } else {
        await db.query("UPDATE receipts SET status = 'failed' WHERE id = ? AND status = 'pending'",
          [receipt.id]);
      }
    }
    // Always acknowledge so Safaricom stops retrying
    res.json({ ResultCode: 0, ResultDesc: 'Accepted' });
  } catch (err) {
    console.error('M-Pesa callback error:', err);
    res.json({ ResultCode: 0, ResultDesc: 'Accepted' });
  }
});

// Demo-mode stand-in for the Safaricom callback
router.post('/simulate', requireLogin, async (req, res, next) => {
  try {
    if (!(SIMULATE || !CONFIGURED)) return res.redirect('/sales?msg=Simulation+is+disabled');
    const r = await finalizeReceipt(Number(req.body.receipt_id), 'SIM' + Date.now().toString().slice(-8));
    res.redirect('/sales?msg=' + (r.ok ? 'Payment+confirmed+-+sale+recorded+automatically' : encodeURIComponent('Could not confirm: ' + r.reason)));
  } catch (err) { next(err); }
});

// Poll receipt status (the sales page refreshes off this)
router.get('/status/:id', requireLogin, async (req, res, next) => {
  try {
    const [[r]] = await db.query('SELECT id, status FROM receipts WHERE id = ?', [req.params.id]);
    res.json(r || { status: 'unknown' });
  } catch (err) { next(err); }
});

module.exports = { router, finalizeReceipt, initiateStk };
