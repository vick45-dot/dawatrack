const express = require('express');
const router = express.Router();
const db = require('../db');
const { finalizeReceipt, initiateStk } = require('./mpesa');
const { openShiftFor } = require('./shifts');

const METHODS = ['cash', 'mpesa', 'card', 'paypal', 'applepay', 'other'];

// ---------- POS screen ----------
router.get('/', async (req, res, next) => {
  try {
    const user = req.session.user;

    const [products] = await db.query(`
      SELECT p.id, p.name, p.selling_price,
             COALESCE(pi.qty_in, 0) - COALESCE(so.qty_out, 0) AS on_hand
      FROM products p
      LEFT JOIN (SELECT product_id, SUM(quantity) AS qty_in FROM purchases GROUP BY product_id) pi
        ON pi.product_id = p.id
      LEFT JOIN (SELECT product_id, SUM(quantity) AS qty_out FROM sales GROUP BY product_id) so
        ON so.product_id = p.id
      ORDER BY p.name
    `);

    const myShift = await openShiftFor(user.id);
    let shiftCashSales = 0;
    if (myShift) {
      const [[c]] = await db.query(
        "SELECT COUNT(*) AS n FROM receipts WHERE shift_id = ? AND payment_method='cash' AND status='paid'",
        [myShift.id]);
      shiftCashSales = c.n;
    }

    // My pending M-Pesa receipts (awaiting STK confirmation)
    const [pending] = await db.query(
      "SELECT * FROM receipts WHERE user_id = ? AND status = 'pending' ORDER BY id DESC LIMIT 5",
      [user.id]);

    let receipts;
    if (user.role === 'owner') {
      [receipts] = await db.query(`
        SELECT r.*, u.name AS seller_name,
               (SELECT COUNT(*) FROM sales s WHERE s.receipt_id = r.id) AS line_count,
               (SELECT SUM(s.quantity * (s.selling_price - s.cost_price)) FROM sales s WHERE s.receipt_id = r.id) AS profit
        FROM receipts r LEFT JOIN users u ON u.id = r.user_id
        ORDER BY r.created_at DESC LIMIT 100
      `);
    } else {
      [receipts] = await db.query(`
        SELECT r.*, (SELECT COUNT(*) FROM sales s WHERE s.receipt_id = r.id) AS line_count
        FROM receipts r
        WHERE r.user_id = ? AND DATE(r.created_at) = CURDATE()
        ORDER BY r.created_at DESC
      `, [user.id]);
    }

    res.render('sales', {
      page: 'sales', products, receipts, myShift, shiftCashSales, pending,
      mpesaSimulation: process.env.MPESA_SIMULATE === 'true' ||
        !(process.env.MPESA_CONSUMER_KEY && process.env.MPESA_CALLBACK_URL),
      msg: req.query.msg,
    });
  } catch (err) { next(err); }
});

// ---------- Checkout ----------
// Body: items = JSON [{product_id, quantity, unit_price?}], payment_method,
//       payment_ref?, customer_phone? (mpesa STK), mpesa_mode = 'stk'|'manual'
router.post('/checkout', async (req, res, next) => {
  const conn = await db.getConnection();
  try {
    const user = req.session.user;
    const method = METHODS.includes(req.body.payment_method) ? req.body.payment_method : null;
    if (!method) { conn.release(); return res.redirect('/sales?msg=Choose+a+payment+method'); }

    let items;
    try { items = JSON.parse(req.body.items || '[]'); } catch { items = []; }
    if (!Array.isArray(items) || !items.length) {
      conn.release(); return res.redirect('/sales?msg=Add+at+least+one+item');
    }

    // Cash discipline: sellers must have an open shift to take cash
    let shiftId = null;
    if (method === 'cash') {
      const shift = await openShiftFor(user.id);
      if (!shift && user.role === 'seller') {
        conn.release();
        return res.redirect('/sales?msg=Open+a+cash+shift+first+(top+of+this+page)');
      }
      shiftId = shift ? shift.id : null;
    }

    // Validate items and settle unit prices
    const clean = [];
    let total = 0;
    for (const raw of items) {
      const pid = Number(raw.product_id);
      const qty = parseInt(raw.quantity, 10);
      if (!pid || !qty || qty <= 0) continue;
      const [[prod]] = await conn.query(
        'SELECT id, selling_price FROM products WHERE id = ?', [pid]);
      if (!prod) continue;
      let price;
      if (user.role === 'seller') {
        if (prod.selling_price === null) {
          conn.release();
          return res.redirect('/sales?msg=No+preset+price+for+an+item+-+ask+the+owner');
        }
        price = Number(prod.selling_price);
      } else {
        price = raw.unit_price !== undefined && raw.unit_price !== ''
          ? parseFloat(raw.unit_price) : Number(prod.selling_price);
        if (isNaN(price) || price < 0) {
          conn.release(); return res.redirect('/sales?msg=Invalid+price+on+an+item');
        }
      }
      clean.push({ product_id: pid, quantity: qty, unit_price: price });
      total += qty * price;
    }
    if (!clean.length) { conn.release(); return res.redirect('/sales?msg=No+valid+items'); }

    const isStk = method === 'mpesa' && req.body.mpesa_mode === 'stk';
    const phone = isStk ? String(req.body.customer_phone || '').trim() : null;
    if (isStk && !phone) { conn.release(); return res.redirect('/sales?msg=Enter+the+customer+phone+number'); }
    const ref = (req.body.payment_ref || '').trim() || null;
    if (method === 'mpesa' && !isStk && !ref) {
      conn.release(); return res.redirect('/sales?msg=Enter+the+M-Pesa+confirmation+code');
    }

    // Create the receipt (pending) with its items
    await conn.beginTransaction();
    const [ins] = await conn.query(
      `INSERT INTO receipts (user_id, shift_id, payment_method, status, total, customer_phone)
       VALUES (?, ?, ?, 'pending', ?, ?)`,
      [user.id, shiftId, method, total.toFixed(2), phone]);
    const receiptId = ins.insertId;
    for (const it of clean) {
      await conn.query(
        'INSERT INTO receipt_items (receipt_id, product_id, quantity, unit_price) VALUES (?, ?, ?, ?)',
        [receiptId, it.product_id, it.quantity, it.unit_price]);
    }
    await conn.commit();
    conn.release();

    if (isStk) {
      // Payment confirmation will record the sale via /mpesa/callback (or simulate)
      const r = await initiateStk(receiptId);
      return res.redirect('/sales?msg=' + encodeURIComponent(r.msg));
    }

    // Cash / manual M-Pesa / card / paypal / applepay / other: finalize now
    const r = await finalizeReceipt(receiptId, ref);
    if (!r.ok) return res.redirect('/sales?msg=' + encodeURIComponent('Not completed: ' + r.reason));
    return res.redirect('/sales?msg=Sale+recorded+' +
      (method === 'cash' && shiftId ? '-+added+to+your+cash+shift' : ''));
  } catch (err) {
    await conn.rollback().catch(() => {});
    conn.release();
    next(err);
  }
});

module.exports = router;
