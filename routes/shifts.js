const express = require('express');
const router = express.Router();
const db = require('../db');
const { requireOwner } = require('../middleware/auth');

// Expected cash for a shift = opening float + all PAID cash receipts in it
async function expectedCash(shiftId) {
  const [[row]] = await db.query(
    `SELECT s.opening_float + COALESCE(SUM(r.total), 0) AS expected
     FROM shifts s
     LEFT JOIN receipts r ON r.shift_id = s.id AND r.payment_method = 'cash' AND r.status = 'paid'
     WHERE s.id = ?
     GROUP BY s.id`, [shiftId]);
  return row ? Number(row.expected) : 0;
}

async function openShiftFor(userId) {
  const [[shift]] = await db.query(
    'SELECT * FROM shifts WHERE user_id = ? AND closed_at IS NULL ORDER BY id DESC LIMIT 1', [userId]);
  return shift || null;
}

// Open a shift (any logged-in user; sellers need one before taking cash)
router.post('/open', async (req, res, next) => {
  try {
    const existing = await openShiftFor(req.session.user.id);
    if (existing) return res.redirect('/sales?msg=You+already+have+an+open+shift');
    const float = Math.max(0, parseFloat(req.body.opening_float) || 0);
    await db.query('INSERT INTO shifts (user_id, opening_float) VALUES (?, ?)',
      [req.session.user.id, float]);
    res.redirect('/sales?msg=Shift+opened+with+float+' + float.toFixed(2));
  } catch (err) { next(err); }
});

// Close my shift: declare counted cash; variance is stamped permanently
router.post('/close', async (req, res, next) => {
  try {
    const shift = await openShiftFor(req.session.user.id);
    if (!shift) return res.redirect('/sales?msg=No+open+shift');
    const declared = parseFloat(req.body.declared_cash);
    if (isNaN(declared) || declared < 0) return res.redirect('/sales?msg=Enter+the+counted+cash+amount');
    const expected = await expectedCash(shift.id);
    const variance = declared - expected;
    await db.query(
      'UPDATE shifts SET closed_at = NOW(), expected_cash = ?, declared_cash = ?, variance = ? WHERE id = ?',
      [expected.toFixed(2), declared.toFixed(2), variance.toFixed(2), shift.id]);
    res.redirect('/sales?msg=' + encodeURIComponent(
      `Shift closed. Expected ${expected.toFixed(2)}, declared ${declared.toFixed(2)}, variance ${variance.toFixed(2)}`));
  } catch (err) { next(err); }
});

// Owner: full shift history with variances, plus live open shifts
router.get('/', requireOwner, async (req, res, next) => {
  try {
    const [shifts] = await db.query(`
      SELECT sh.*, u.name AS seller_name,
        sh.opening_float + COALESCE(cash.paid_cash, 0) AS live_expected,
        COALESCE(cash.cash_count, 0) AS cash_receipts
      FROM shifts sh
      JOIN users u ON u.id = sh.user_id
      LEFT JOIN (
        SELECT shift_id, SUM(total) AS paid_cash, COUNT(*) AS cash_count
        FROM receipts WHERE payment_method = 'cash' AND status = 'paid'
        GROUP BY shift_id
      ) cash ON cash.shift_id = sh.id
      ORDER BY sh.opened_at DESC
      LIMIT 100
    `);
    res.render('shifts', { page: 'shifts', shifts });
  } catch (err) { next(err); }
});

module.exports = { router, openShiftFor, expectedCash };
