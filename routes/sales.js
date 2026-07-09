const express = require('express');
const router = express.Router();
const db = require('../db');

// Stock OUT. Owners see the full ledger with profit and who sold;
// sellers see only their own sales today, with no cost/profit figures.
router.get('/', async (req, res, next) => {
  try {
    const user = req.session.user;
    let sales;
    if (user.role === 'owner') {
      [sales] = await db.query(`
        SELECT s.*, p.name AS product_name, p.unit, u.name AS seller_name,
               s.quantity * s.selling_price                  AS line_revenue,
               s.quantity * (s.selling_price - s.cost_price) AS line_profit
        FROM sales s
        JOIN products p ON p.id = s.product_id
        LEFT JOIN users u ON u.id = s.user_id
        ORDER BY s.sold_at DESC
        LIMIT 200
      `);
    } else {
      [sales] = await db.query(`
        SELECT s.*, p.name AS product_name, p.unit,
               s.quantity * s.selling_price AS line_revenue
        FROM sales s
        JOIN products p ON p.id = s.product_id
        WHERE s.user_id = ? AND DATE(s.sold_at) = CURDATE()
        ORDER BY s.sold_at DESC
      `, [user.id]);
    }

    // Products with stock + preset price for the sell form
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
    res.render('sales', { page: 'sales', sales, products, msg: req.query.msg });
  } catch (err) { next(err); }
});

// Record a sale. Transaction + product row lock = no overselling, ever.
// Sellers ALWAYS sell at the owner's preset price; owners may override.
router.post('/', async (req, res, next) => {
  const conn = await db.getConnection();
  try {
    const user = req.session.user;
    const { product_id, quantity, selling_price } = req.body;
    const qty = parseInt(quantity, 10);

    if (!product_id) { conn.release(); return res.redirect('/sales?msg=Choose+a+product'); }
    if (!qty || qty <= 0) { conn.release(); return res.redirect('/sales?msg=Quantity+must+be+above+zero'); }

    await conn.beginTransaction();

    // Lock the product row: serializes concurrent sales of the same product
    const [lockRows] = await conn.query(
      'SELECT id, selling_price FROM products WHERE id = ? FOR UPDATE',
      [product_id]
    );
    if (!lockRows.length) {
      await conn.rollback(); conn.release();
      return res.redirect('/sales?msg=Product+not+found');
    }
    const preset = lockRows[0].selling_price;

    // Price policy: sellers use the preset; owners may type their own
    let price;
    if (user.role === 'seller') {
      if (preset === null) {
        await conn.rollback(); conn.release();
        return res.redirect('/sales?msg=No+selling+price+set+-+ask+the+owner');
      }
      price = Number(preset);
    } else {
      price = selling_price !== '' && selling_price !== undefined
        ? parseFloat(selling_price)
        : (preset !== null ? Number(preset) : NaN);
      if (isNaN(price) || price < 0) {
        await conn.rollback(); conn.release();
        return res.redirect('/sales?msg=Enter+a+valid+selling+price');
      }
    }

    const [[position]] = await conn.query(
      `
      SELECT
        COALESCE((SELECT SUM(quantity) FROM purchases WHERE product_id = ?), 0) -
        COALESCE((SELECT SUM(quantity) FROM sales     WHERE product_id = ?), 0) AS on_hand,
        COALESCE((SELECT SUM(quantity * buying_price) / SUM(quantity)
                  FROM purchases WHERE product_id = ?), 0) AS avg_cost
      `,
      [product_id, product_id, product_id]
    );

    if (position.on_hand < qty) {
      await conn.rollback(); conn.release();
      return res.redirect(`/sales?msg=Only+${position.on_hand}+in+stock`);
    }

    await conn.query(
      'INSERT INTO sales (product_id, user_id, quantity, selling_price, cost_price) VALUES (?, ?, ?, ?, ?)',
      [product_id, user.id, qty, price, Number(position.avg_cost).toFixed(2)]
    );

    await conn.commit();
    conn.release();
    res.redirect('/sales?msg=Sale+recorded');
  } catch (err) {
    await conn.rollback().catch(() => {});
    conn.release();
    next(err);
  }
});

module.exports = router;
