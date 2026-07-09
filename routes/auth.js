const express = require('express');
const bcrypt = require('bcryptjs');
const router = express.Router();
const db = require('../db');

router.get('/login', (req, res) => {
  if (req.session.user) {
    return res.redirect(req.session.user.role === 'owner' ? '/' : '/sales');
  }
  res.render('login', { error: null });
});

router.post('/login', async (req, res, next) => {
  try {
    const { username, password } = req.body;
    const [rows] = await db.query(
      'SELECT * FROM users WHERE username = ? AND active = 1',
      [(username || '').trim()]
    );
    const user = rows[0];
    if (!user || !bcrypt.compareSync(password || '', user.password_hash)) {
      return res.render('login', { error: 'Wrong username or password.' });
    }
    req.session.user = { id: user.id, name: user.name, role: user.role };
    res.redirect(user.role === 'owner' ? '/' : '/sales');
  } catch (err) { next(err); }
});

router.post('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/login'));
});

module.exports = router;
