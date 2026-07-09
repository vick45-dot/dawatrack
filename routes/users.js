const express = require('express');
const bcrypt = require('bcryptjs');
const router = express.Router();
const db = require('../db');

// List all accounts + today's activity per seller
router.get('/', async (req, res, next) => {
  try {
    const [users] = await db.query(`
      SELECT u.*, COALESCE(t.transactions, 0) AS today_transactions,
             COALESCE(t.revenue, 0) AS today_revenue
      FROM users u
      LEFT JOIN (
        SELECT user_id, COUNT(*) AS transactions, SUM(quantity * selling_price) AS revenue
        FROM sales WHERE DATE(sold_at) = CURDATE() GROUP BY user_id
      ) t ON t.user_id = u.id
      ORDER BY u.role, u.name
    `);
    res.render('users', { page: 'users', users, msg: req.query.msg });
  } catch (err) { next(err); }
});

// Add a seller (or another owner)
router.post('/', async (req, res, next) => {
  try {
    const { name, username, password, role } = req.body;
    if (!name || !username || !password) return res.redirect('/users?msg=All+fields+are+required');
    if (password.length < 6) return res.redirect('/users?msg=Password+must+be+at+least+6+characters');
    const hash = bcrypt.hashSync(password, 10);
    const safeRole = role === 'owner' ? 'owner' : 'seller';
    await db.query(
      'INSERT INTO users (name, username, password_hash, role) VALUES (?, ?, ?, ?)',
      [name.trim(), username.trim().toLowerCase(), hash, safeRole]
    );
    res.redirect('/users?msg=Account+created');
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return res.redirect('/users?msg=That+username+is+taken');
    next(err);
  }
});

// Activate / deactivate an account (can't deactivate yourself)
router.post('/:id/toggle', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (id === req.session.user.id) return res.redirect('/users?msg=You+cannot+deactivate+yourself');
    await db.query('UPDATE users SET active = 1 - active WHERE id = ?', [id]);
    res.redirect('/users?msg=Account+updated');
  } catch (err) { next(err); }
});

// Change your own password
router.post('/password', async (req, res, next) => {
  try {
    const { current_password, new_password } = req.body;
    const [[me]] = await db.query('SELECT * FROM users WHERE id = ?', [req.session.user.id]);
    if (!me || !bcrypt.compareSync(current_password || '', me.password_hash)) {
      return res.redirect('/users?msg=Current+password+is+wrong');
    }
    if (!new_password || new_password.length < 6) {
      return res.redirect('/users?msg=New+password+must+be+at+least+6+characters');
    }
    await db.query('UPDATE users SET password_hash = ? WHERE id = ?', [
      bcrypt.hashSync(new_password, 10), req.session.user.id,
    ]);
    res.redirect('/users?msg=Password+changed');
  } catch (err) { next(err); }
});

module.exports = router;
