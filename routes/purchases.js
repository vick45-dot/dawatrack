const express = require('express');
const router = express.Router();
const db = require('../db');

// Stock IN ledger
router.get('/', async (req, res, next) => {
  try {
    const [purchases] = await db.query(`
      SELECT pu.*, p.name AS product_name, p.unit
      FROM purchases pu JOIN products p ON p.id = pu.product_id
      ORDER BY pu.received_at DESC
      LIMIT 200
    `);
    const [products] = await db.query('SELECT id, name FROM products ORDER BY name');
    res.render('purchases', { page: 'purchases', purchases, products, msg: req.query.msg });
  } catch (err) { next(err); }
});

// Record incoming stock
router.post('/', async (req, res, next) => {
  try {
    const { product_id, supplier, batch_number, expiry_date, quantity, buying_price } = req.body;
    const qty = parseInt(quantity, 10);
    const price = parseFloat(buying_price);

    if (!product_id) return res.redirect('/purchases?msg=Choose+a+product');
    if (!qty || qty <= 0) return res.redirect('/purchases?msg=Quantity+must+be+above+zero');
    if (isNaN(price) || price < 0) return res.redirect('/purchases?msg=Enter+a+valid+buying+price');

    await db.query(
      `INSERT INTO purchases (product_id, supplier, batch_number, expiry_date, quantity, buying_price)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [product_id, supplier || null, batch_number || null, expiry_date || null, qty, price]
    );
    res.redirect('/purchases?msg=Stock+received');
  } catch (err) { next(err); }
});

module.exports = router;
