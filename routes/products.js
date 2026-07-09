const express = require('express');
const router = express.Router();
const db = require('../db');

// List all products with live stock on hand
router.get('/', async (req, res, next) => {
  try {
    const q = (req.query.q || '').trim();
    const [products] = await db.query(
      `
      SELECT p.*,
             COALESCE(pi.qty_in, 0) - COALESCE(so.qty_out, 0) AS on_hand,
             COALESCE(pi.avg_cost, 0)                         AS avg_cost
      FROM products p
      LEFT JOIN (
        SELECT product_id, SUM(quantity) AS qty_in,
               SUM(quantity * buying_price) / SUM(quantity) AS avg_cost
        FROM purchases GROUP BY product_id
      ) pi ON pi.product_id = p.id
      LEFT JOIN (
        SELECT product_id, SUM(quantity) AS qty_out FROM sales GROUP BY product_id
      ) so ON so.product_id = p.id
      WHERE p.name LIKE ? OR p.category LIKE ?
      ORDER BY p.name
      `,
      [`%${q}%`, `%${q}%`]
    );
    res.render('products', { page: 'products', products, q, msg: req.query.msg });
  } catch (err) { next(err); }
});

// Add a product
router.post('/', async (req, res, next) => {
  try {
    const { name, category, unit, selling_price, reorder_level } = req.body;
    if (!name || !name.trim()) return res.redirect('/products?msg=Name+is+required');
    await db.query(
      'INSERT INTO products (name, category, unit, selling_price, reorder_level) VALUES (?, ?, ?, ?, ?)',
      [name.trim(), category || 'General', unit || 'piece', selling_price ? parseFloat(selling_price) : null, Number(reorder_level) || 10]
    );
    res.redirect('/products?msg=Product+added');
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return res.redirect('/products?msg=That+product+already+exists');
    next(err);
  }
});

module.exports = router;
